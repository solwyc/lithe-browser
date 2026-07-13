// Copyright 2026 Lithe contributors. Licensed under the MIT License.
//
// Replaces every group-icon resource in a Windows executable with the frames
// from an .ico file. Keeping this helper tiny avoids adding a packaging-time
// dependency solely for development artifact builds.

#include <windows.h>

#include <cstdint>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#pragma pack(push, 1)
struct IconDirectory {
  std::uint16_t reserved;
  std::uint16_t type;
  std::uint16_t count;
};

struct IconDirectoryEntry {
  std::uint8_t width;
  std::uint8_t height;
  std::uint8_t color_count;
  std::uint8_t reserved;
  std::uint16_t planes;
  std::uint16_t bit_count;
  std::uint32_t bytes_in_resource;
  std::uint32_t image_offset;
};

struct GroupIconDirectoryEntry {
  std::uint8_t width;
  std::uint8_t height;
  std::uint8_t color_count;
  std::uint8_t reserved;
  std::uint16_t planes;
  std::uint16_t bit_count;
  std::uint32_t bytes_in_resource;
  std::uint16_t resource_id;
};
#pragma pack(pop)

struct ResourceName {
  bool is_integer = false;
  std::uint16_t integer = 0;
  std::wstring text;

  LPCWSTR value() const {
    return is_integer ? MAKEINTRESOURCEW(integer) : text.c_str();
  }
};

struct GroupResource {
  ResourceName name;
  std::vector<WORD> languages;
};

static BOOL CALLBACK CollectNames(HMODULE, LPCWSTR, LPWSTR name,
                                  LONG_PTR context) {
  auto* groups = reinterpret_cast<std::vector<GroupResource>*>(context);
  GroupResource group;
  if (IS_INTRESOURCE(name)) {
    group.name.is_integer = true;
    group.name.integer = static_cast<std::uint16_t>(
        reinterpret_cast<ULONG_PTR>(name));
  } else {
    group.name.text = name;
  }
  groups->push_back(std::move(group));
  return TRUE;
}

static BOOL CALLBACK CollectLanguages(HMODULE, LPCWSTR, LPCWSTR, WORD language,
                                      LONG_PTR context) {
  auto* languages = reinterpret_cast<std::vector<WORD>*>(context);
  languages->push_back(language);
  return TRUE;
}

template <typename T>
bool ReadStruct(const std::vector<std::uint8_t>& bytes, std::size_t offset,
                const T** result) {
  if (offset > bytes.size() || sizeof(T) > bytes.size() - offset) {
    return false;
  }
  *result = reinterpret_cast<const T*>(bytes.data() + offset);
  return true;
}

int wmain(int argc, wchar_t** argv) {
  if (argc != 3) {
    std::wcerr << L"Usage: lithe_resource_brand.exe <executable> <icon.ico>\n";
    return 2;
  }

  std::ifstream icon_file(argv[2], std::ios::binary | std::ios::ate);
  if (!icon_file) {
    std::wcerr << L"Could not open icon: " << argv[2] << L"\n";
    return 3;
  }
  const auto icon_size = icon_file.tellg();
  if (icon_size <= 0) {
    std::wcerr << L"Icon file is empty.\n";
    return 4;
  }
  std::vector<std::uint8_t> icon_bytes(static_cast<std::size_t>(icon_size));
  icon_file.seekg(0);
  icon_file.read(reinterpret_cast<char*>(icon_bytes.data()), icon_size);

  const IconDirectory* directory = nullptr;
  if (!ReadStruct(icon_bytes, 0, &directory) || directory->reserved != 0 ||
      directory->type != 1 || directory->count == 0) {
    std::wcerr << L"The input is not a valid Windows icon.\n";
    return 5;
  }

  std::vector<const IconDirectoryEntry*> entries;
  for (std::uint16_t index = 0; index < directory->count; ++index) {
    const IconDirectoryEntry* entry = nullptr;
    const std::size_t offset = sizeof(IconDirectory) +
                               index * sizeof(IconDirectoryEntry);
    if (!ReadStruct(icon_bytes, offset, &entry) ||
        entry->image_offset > icon_bytes.size() ||
        entry->bytes_in_resource > icon_bytes.size() - entry->image_offset) {
      std::wcerr << L"The icon contains an invalid frame.\n";
      return 6;
    }
    entries.push_back(entry);
  }

  std::vector<GroupResource> groups;
  HMODULE module = LoadLibraryExW(
      argv[1], nullptr, LOAD_LIBRARY_AS_DATAFILE | LOAD_LIBRARY_AS_IMAGE_RESOURCE);
  if (module) {
    EnumResourceNamesW(module, MAKEINTRESOURCEW(14), CollectNames,
                       reinterpret_cast<LONG_PTR>(&groups));
    for (auto& group : groups) {
      EnumResourceLanguagesW(module, MAKEINTRESOURCEW(14), group.name.value(),
                             CollectLanguages,
                             reinterpret_cast<LONG_PTR>(&group.languages));
    }
    FreeLibrary(module);
  }

  if (groups.empty()) {
    GroupResource fallback;
    fallback.name.is_integer = true;
    fallback.name.integer = 1;
    fallback.languages.push_back(MAKELANGID(LANG_NEUTRAL, SUBLANG_NEUTRAL));
    groups.push_back(std::move(fallback));
  }
  for (auto& group : groups) {
    if (group.languages.empty()) {
      group.languages.push_back(MAKELANGID(LANG_NEUTRAL, SUBLANG_NEUTRAL));
    }
  }

  std::vector<std::uint8_t> group_bytes(
      sizeof(IconDirectory) + entries.size() * sizeof(GroupIconDirectoryEntry));
  auto* group_directory = reinterpret_cast<IconDirectory*>(group_bytes.data());
  *group_directory = *directory;
  auto* group_entries = reinterpret_cast<GroupIconDirectoryEntry*>(
      group_bytes.data() + sizeof(IconDirectory));

  constexpr std::uint16_t kFirstIconResource = 50000;
  for (std::size_t index = 0; index < entries.size(); ++index) {
    const auto* source = entries[index];
    group_entries[index] = {
        source->width,
        source->height,
        source->color_count,
        source->reserved,
        source->planes,
        source->bit_count,
        source->bytes_in_resource,
        static_cast<std::uint16_t>(kFirstIconResource + index),
    };
  }

  HANDLE update = BeginUpdateResourceW(argv[1], FALSE);
  if (!update) {
    std::wcerr << L"Could not open executable resources (error "
               << GetLastError() << L").\n";
    return 7;
  }

  bool success = true;
  for (const auto& group : groups) {
    for (WORD language : group.languages) {
      for (std::size_t index = 0; index < entries.size(); ++index) {
        const auto* entry = entries[index];
        success = success && UpdateResourceW(
            update, MAKEINTRESOURCEW(3),
            MAKEINTRESOURCEW(kFirstIconResource +
                             static_cast<std::uint16_t>(index)),
            language, icon_bytes.data() + entry->image_offset,
            entry->bytes_in_resource);
      }
      success = success && UpdateResourceW(
          update, MAKEINTRESOURCEW(14), group.name.value(), language,
          group_bytes.data(), static_cast<DWORD>(group_bytes.size()));
    }
  }

  if (!EndUpdateResourceW(update, success ? FALSE : TRUE) || !success) {
    std::wcerr << L"Could not write executable icon resources (error "
               << GetLastError() << L").\n";
    return 8;
  }

  std::wcout << L"Applied Lithe icon to " << argv[1] << L"\n";
  return 0;
}
