export async function getCanvasName() {
  try {
    // 1. Retrieve the token saved during sign-in
    const token = localStorage.getItem("authToken"); 

    if (!token) {
      console.error("No token found in localStorage");
      return null;
    }

    const res = await fetch("/api/canvas-name", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        
        "Authorization": `Bearer ${token}` 
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to fetch");
    }

    const data = await res.json();
    return data.canvasName;
  } catch (err) {
    console.error("getCanvasName Error:", err);
    return null;
  }
}