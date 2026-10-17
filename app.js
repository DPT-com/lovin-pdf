(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const workspace = $("#workspace");
  const formHost = $("#tool-form");
  const statusBox = $("#status");
  const titleBox = $("#workspace-title");
  const descriptionBox = $("#tool-description");

  let activeTool = "";
  let downloadUrl = null;

  const tools = {
    merge: {
      title: "Merge PDF",
      description: "Select two or more PDF files. They will be combined in the selected order.",
      fields: `
        <div>
          <label class="field-label" for="pdf-files">Choose PDF files</label>
          <input class="file-input" id="pdf-files" type="file" accept=".pdf,application/pdf" multiple required>
          <div class="file-hint">Select at least two PDF files.</div>
        </div>`,
      run: mergePDF
    },
    split: {
      title: "Split PDF",
      description: "Extract selected pages into a separate PDF. Example: 1-3,5",
      fields: `
        <div>
          <label class="field-label" for="pdf-files">Choose a PDF</label>
          <input class="file-input" id="pdf-files" type="file" accept=".pdf,application/pdf" required>
        </div>
        <div>
          <label class="field-label" for="page-range">Pages to extract</label>
          <input class="text-input" id="page-range" type="text" placeholder="e.g. 1-3,5" required>
          <div class="file-hint">Page numbers start at 1. Example: 1-3,5 extracts pages 1, 2, 3 and 5.</div>
        </div>`,
      run: splitPDF
    },
    rotate: {
      title: "Rotate PDF",
      description: "Rotate all pages by 90, 180 or 270 degrees.",
      fields: `
        <div>
          <label class="field-label" for="pdf-files">Choose a PDF</label>
          <input class="file-input" id="pdf-files" type="file" accept=".pdf,application/pdf" required>
        </div>
        <div>
          <label class="field-label" for="rotation">Rotation</label>
          <select class="select-input" id="rotation">
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">270° clockwise</option>
          </select>
        </div>`,
      run: rotatePDF
    },
    jpg: {
      title: "JPG to PDF",
      description: "Convert JPG, JPEG or PNG images into one PDF file.",
      fields: `
        <div>
          <label class="field-label" for="image-files">Choose images</label>
          <input class="file-input" id="image-files" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple required>
          <div class="file-hint">Select images in the order you want them in the PDF.</div>
        </div>`,
      run: imagesToPDF
    },
    numbers: {
      title: "Add page numbers",
      description: "Add a page number to each page of your PDF.",
      fields: `
        <div>
          <label class="field-label" for="pdf-files">Choose a PDF</label>
          <input class="file-input" id="pdf-files" type="file" accept=".pdf,application/pdf" required>
        </div>
        <div>
          <label class="field-label" for="number-position">Number position</label>
          <select class="select-input" id="number-position">
            <option value="bottom">Bottom centre</option>
            <option value="top">Top centre</option>
          </select>
        </div>`,
      run: numberPDF
    },
    watermark: {
      title: "Watermark PDF",
      description: "Place a text watermark diagonally on each page.",
      fields: `
        <div>
          <label class="field-label" for="pdf-files">Choose a PDF</label>
          <input class="file-input" id="pdf-files" type="file" accept=".pdf,application/pdf" required>
        </div>
        <div>
          <label class="field-label" for="watermark-text">Watermark text</label>
          <input class="text-input" id="watermark-text" type="text" maxlength="80" placeholder="e.g. CONFIDENTIAL" required>
        </div>`,
      run: watermarkPDF
    },
    compress: {
      title: "Optimize PDF save",
      description: "Re-save the PDF with pdf-lib object streams. This is not image recompression, so the output may not be smaller.",
      fields: `
        <div>
          <label class="field-label" for="pdf-files">Choose a PDF</label>
          <input class="file-input" id="pdf-files" type="file" accept=".pdf,application/pdf" required>
          <div class="file-hint">This basic tool does not downsample images or guarantee a smaller file.</div>
        </div>`,
      run: compressPDF
    },
    pdfToJpg: {
      title: "PDF to JPG",
      description: "Convert each PDF page into a JPG image and download all images in one ZIP file.",
      fields: `
        <div>
          <label class="field-label" for="pdf-to-jpg-file">Choose a PDF</label>
          <input class="file-input" id="pdf-to-jpg-file" type="file" accept=".pdf,application/pdf" required>
          <div class="file-hint">For best results on mobile, start with a small PDF.</div>
        </div>`,
      run: pdfToJpg
    }
  };

  function setStatus(message, type = "") {
    statusBox.textContent = message;
    statusBox.className = "status" + (type ? " " + type : "");
  }

  function clearDownloadUrl() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
  }

  function openTool(name) {
    const tool = tools[name];
    if (!tool) return;

    clearDownloadUrl();
    activeTool = name;
    titleBox.textContent = tool.title;
    descriptionBox.textContent = tool.description;
    formHost.innerHTML = tool.fields + `
      <button class="run-btn" id="run-tool" type="button">${name === "pdf-to-jpg" ? "Convert and download JPGs (ZIP)" : "Process and download PDF"}</button>`;
    setStatus("");
    workspace.hidden = false;
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });

    $("#run-tool").addEventListener("click", async () => {
      const button = $("#run-tool");
      button.disabled = true;
      button.textContent = "Processing…";
      setStatus("Processing your file in this browser. Please wait.");

      try {
        if (!window.PDFLib) {
          throw new Error("PDF library load nahi hui. Internet connection check karke page refresh karein.");
        }
        await tool.run();
      } catch (error) {
        console.error(error);
        setStatus(error && error.message ? error.message : "Processing failed. Please try another file.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "Process and download PDF";
      }
    });
  }

  function getFile(id = "pdf-files") {
    const input = document.getElementById(id);
    const file = input && input.files && input.files[0];
    if (!file) throw new Error("Pehle file select karein.");
    if (file.size > 100 * 1024 * 1024) {
      throw new Error("Yeh basic version 100 MB se bari files ko reject karta hai. Chhoti file try karein.");
    }
    return file;
  }

  function getFiles(id) {
    const input = document.getElementById(id);
    const files = input && input.files ? Array.from(input.files) : [];
    if (!files.length) throw new Error("Pehle file select karein.");
    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) {
        throw new Error("Koi file 100 MB se bari hai. Chhoti files try karein.");
      }
    }
    return files;
  }

  async function loadPDF(file) {
    const bytes = await file.arrayBuffer();
    return PDFLib.PDFDocument.load(bytes);
  }

  async function saveAndDownload(pdf, filename) {
    const bytes = await pdf.save({ useObjectStreams: true });
    clearDownloadUrl();
    const blob = new Blob([bytes], { type: "application/pdf" });
    downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setStatus("Done! Download start ho gaya. Agar prompt aaye to Download/Save choose karein.", "success");
  }

  function safeBaseName(name) {
    return name.replace(/\.pdf$/i, "").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 70) || "document";
  }

  async function mergePDF() {
    const files = getFiles("pdf-files");
    if (files.length < 2) throw new Error("Merge ke liye kam az kam 2 PDF files select karein.");

    const merged = await PDFLib.PDFDocument.create();
    for (const file of files) {
      const source = await loadPDF(file);
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    }
    await saveAndDownload(merged, "merged.pdf");
  }

  async function splitPDF() {
    const file = getFile();
    const source = await loadPDF(file);
    const total = source.getPageCount();
    const input = $("#page-range").value.trim();
    if (!input) throw new Error("Pages ka range enter karein, misal: 1-3,5.");

    const indexes = new Set();
    for (const part of input.split(",")) {
      const token = part.trim();
      if (!token) continue;
      const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error("Range format ghalat hai. Misal: 1-3,5");
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      if (start < 1 || end < start || end > total) {
        throw new Error(`Page range 1 se ${total} ke darmiyan hona chahiye.`);
      }
      for (let p = start; p <= end; p++) indexes.add(p - 1);
    }
    const selected = Array.from(indexes).sort((a, b) => a - b);
    if (!selected.length) throw new Error("Kam az kam ek valid page select karein.");

    const output = await PDFLib.PDFDocument.create();
    const pages = await output.copyPages(source, selected);
    pages.forEach(page => output.addPage(page));
    await saveAndDownload(output, safeBaseName(file.name) + "_split.pdf");
  }

  async function rotatePDF() {
    const file = getFile();
    const pdf = await loadPDF(file);
    const degrees = Number($("#rotation").value);
    pdf.getPages().forEach(page => {
      page.setRotation(PDFLib.degrees((page.getRotation().angle + degrees) % 360));
    });
    await saveAndDownload(pdf, safeBaseName(file.name) + "_rotated.pdf");
  }

  async function imagesToPDF() {
    const files = getFiles("image-files");
    const pdf = await PDFLib.PDFDocument.create();

    for (const file of files) {
      const name = file.name.toLowerCase();
      const bytes = await file.arrayBuffer();
      let image;

      if (name.endsWith(".jpg") || name.endsWith(".jpeg") || file.type === "image/jpeg") {
        image = await pdf.embedJpg(bytes);
      } else if (name.endsWith(".png") || file.type === "image/png") {
        image = await pdf.embedPng(bytes);
      } else {
        throw new Error("Sirf JPG, JPEG aur PNG images supported hain.");
      }

      const dimensions = image.scale(1);
      const maxWidth = 595.28;
      const maxHeight = 841.89;
      const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, 1);
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      const page = pdf.addPage([maxWidth, maxHeight]);
      page.drawImage(image, {
        x: (maxWidth - width) / 2,
        y: (maxHeight - height) / 2,
        width,
        height
      });
    }
    await saveAndDownload(pdf, "images.pdf");
  }

  async function numberPDF() {
    const file = getFile();
    const pdf = await loadPDF(file);
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const position = $("#number-position").value;

    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      const text = String(index + 1);
      const size = 10;
      const textWidth = font.widthOfTextAtSize(text, size);
      const y = position === "top" ? height - 24 : 18;
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y,
        size,
        font,
        color: PDFLib.rgb(0.25, 0.28, 0.35)
      });
    });
    await saveAndDownload(pdf, safeBaseName(file.name) + "_numbered.pdf");
  }

  async function watermarkPDF() {
    const file = getFile();
    const text = $("#watermark-text").value.trim();
    if (!text) throw new Error("Watermark text enter karein.");

    const pdf = await loadPDF(file);
    const font = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

    pdf.getPages().forEach(page => {
      const { width, height } = page.getSize();
      const size = Math.max(18, Math.min(48, width / 12));
      const textWidth = font.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: Math.max(10, (width - textWidth) / 2),
        y: height / 2,
        size,
        font,
        rotate: PDFLib.degrees(35),
        color: PDFLib.rgb(0.72, 0.72, 0.76),
        opacity: 0.3
      });
    });
    await saveAndDownload(pdf, safeBaseName(file.name) + "_watermarked.pdf");
  }

  async function compressPDF() {
    const file = getFile();
    const pdf = await loadPDF(file);
    await saveAndDownload(pdf, safeBaseName(file.name) + "_optimized.pdf");
    setStatus("Saved. Note: this tool does not recompress images, so the new PDF may be the same size or larger.", "success");
  }

  async function pdfToJpg() {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js load nahi hui. Internet check karke page refresh karein.");
    }
    if (!window.JSZip) {
      throw new Error("ZIP library load nahi hui. Internet check karke page refresh karein.");
    }

    const file = getFile("pdf-to-jpg-file");
    if (file.size > 30 * 1024 * 1024) {
      throw new Error("Mobile par pehle 30 MB se chhoti PDF try karein.");
    }

    setStatus("PDF pages render ho rahe hain. Bara document ho to waqt lag sakta hai.");
    const data = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    const zip = new window.JSZip();

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        setStatus("Page " + pageNumber + " / " + pdf.numPages + " convert ho raha hai...");
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas available nahi hai.");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({ canvasContext: context, viewport }).promise;

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(result => {
            if (result) resolve(result);
            else reject(new Error("Page " + pageNumber + " ki JPG nahi ban saki."));
          }, "image/jpeg", 0.88);
        });

        zip.file("page-" + String(pageNumber).padStart(3, "0") + ".jpg", blob);
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }

      setStatus("JPG images ZIP mein pack ho rahi hain...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      clearDownloadUrl();
      downloadUrl = URL.createObjectURL(zipBlob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = safeBaseName(file.name) + "_jpg_images.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setStatus("Conversion complete! JPG images ZIP file mein download ho rahi hain.", "success");
    } finally {
      await pdf.destroy();
    }
  }

  document.querySelectorAll("[data-tool]").forEach(button => {
    button.addEventListener("click", () => openTool(button.dataset.tool));
  });

  $("#close-tool").addEventListener("click", () => {
    workspace.hidden = true;
    formHost.innerHTML = "";
    setStatus("");
    clearDownloadUrl();
    $("#tools").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#year").textContent = new Date().getFullYear();

  window.addEventListener("pagehide", clearDownloadUrl);
})();
