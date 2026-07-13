# Lithe development packaging tools

Artifact builds reuse Mozilla's precompiled native launcher. After each build,
run the following command from PowerShell to create `dist/bin/lithe.exe` and
embed Lithe's Windows icon:

```powershell
& .\lithe_tools\apply-windows-branding.ps1
```

The script compiles the small MIT-licensed resource helper with the Windows SDK
already used by Gecko. A full native release build should move the icon into the
normal installer/package pipeline instead.

## Reproducing the Vibes model

Vibes packages only the pinned q8 ONNX files for the MIT-licensed BGE Small
model. Install `huggingface_hub`, then reproduce and checksum the model with:

```powershell
& .\lithe_tools\fetch-vibes-model.ps1 -Python python
```

The browser loads this packaged copy through a local `chrome://` URL; it does
not use Hugging Face hosted inference at runtime.
