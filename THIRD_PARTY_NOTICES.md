# Third-party notices

## Mozilla Firefox / Gecko

Lithe is based on the Mozilla Firefox source tree at revision
`d4ae522db3b933e502d1febec899e7955c1fb633`.

Firefox source code is available from
<https://github.com/mozilla-firefox/firefox>. Most Mozilla product code is
licensed under MPL-2.0, with additional licenses and notices documented in the
upstream tree. No Mozilla trademark license is granted.

## BGE Small English v1.5

Vibes uses a quantized ONNX conversion of BGE Small for local website category
embeddings.

- Original model: `BAAI/bge-small-en-v1.5`
- Original revision: `5c38ec7c405ec4b44b94cc5a9bb96e735b38267a`
- ONNX conversion: `Xenova/bge-small-en-v1.5`
- Conversion revision: `ea104dacec62c0de699686887e3f920caeb4f3e3`
- Quantization: q8
- License: MIT

The MIT license text and per-file SHA-256 manifest are included under
`overlay/browser/components/vibes/`. Model files are downloaded only during
source preparation and are packaged for local inference; Lithe does not use
Hugging Face hosted inference at runtime.

## Windows resource helper

`overlay/lithe_tools/lithe_resource_brand.cpp` is distributed under the MIT
license. Its license text is included beside the helper.
