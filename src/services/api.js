
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

export async function analyzeBrandContent(brandId, content) {
  const response = await fetch(
    `${API_BASE_URL}/api/brands/${brandId}/ai-analyze`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `HTTP ${response.status}`
    );
  }

  return data.analysis ?? data;
}
