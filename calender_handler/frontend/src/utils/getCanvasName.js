export async function getCanvasName() {
  try {
    const res = await fetch("/api/canvas-name");
    if (!res.ok) throw new Error("Failed to fetch Canvas name");
    const data = await res.json();
    return data.canvasName;
  } catch (err) {
    console.error(err);
    return null;
  }
}