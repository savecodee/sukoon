export async function saveTreeCard(caption: { score: number; stage: string; intention: string; project: string | null }) {
  const node = document.querySelector("[data-tree-svg]");
  if (!(node instanceof SVGSVGElement)) return false;
  const clone = node.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "440");
  clone.setAttribute("height", "472");
  const css = getComputedStyle(document.documentElement);
  let xml = new XMLSerializer().serializeToString(clone);
  xml = xml.replace(/var\((--[^)]+)\)/g, (_, name: string) => css.getPropertyValue(name).trim() || "#8eae86");
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("svg"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1040;
    const pen = canvas.getContext("2d");
    if (!pen) return false;
    pen.fillStyle = "#141210";
    pen.fillRect(0, 0, 800, 1040);
    pen.fillStyle = "#1e1b17";
    pen.beginPath();
    pen.roundRect(48, 48, 704, 944, 36);
    pen.fill();
    pen.drawImage(image, 120, 80, 560, 600);
    pen.fillStyle = "#8eae86";
    pen.font = "500 28px 'IBM Plex Sans Arabic', sans-serif";
    pen.textAlign = "center";
    pen.fillText(caption.project ? caption.project : "سكون", 400, 720);
    pen.fillStyle = "#f6f1ea";
    pen.font = "500 84px Fraunces, 'IBM Plex Sans Arabic', serif";
    pen.fillText(String(caption.score), 400, 820);
    pen.fillStyle = "#b7ada3";
    pen.font = "400 28px 'IBM Plex Sans Arabic', sans-serif";
    pen.fillText(caption.stage, 400, 870);
    if (caption.intention) {
      pen.fillStyle = "#f6f1ea";
      pen.font = "400 26px 'IBM Plex Sans Arabic', sans-serif";
      const line = caption.intention.length > 42 ? `${caption.intention.slice(0, 41)}…` : caption.intention;
      pen.fillText(line, 400, 930);
    }
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) return false;
    const file = new File([png], "sukoon-tree.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "شجرة سكون" });
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return true;
      }
    }
    const href = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = href;
    link.download = "sukoon-tree.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
