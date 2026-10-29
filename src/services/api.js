import { auth } from "../firebase";

async function authHeaders(extra = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in before using AXION AI.");
  const token = await user.getIdToken();
  return { ...extra, Authorization: `Bearer ${token}` };
}


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

export async function analyzeBrandContent(brandId, content) {
  const response = await fetch(
    `${API_BASE_URL}/api/brands/${brandId}/ai-analyze`,
    {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ content }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `HTTP ${response.status}`
    );
  }

  if (data.analysis) {
    return { ...data.analysis, knowledge_sources_used: data.knowledge_sources_used || [] };
  }
  return data;
}


async function knowledgeRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: await authHeaders({ "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}

export async function listBrands() {
  const data = await knowledgeRequest("/api/brands", { headers: { Accept: "application/json" } });
  return data.brands || [];
}

export async function listKnowledge(brandId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await knowledgeRequest(`/api/brands/${encodeURIComponent(brandId)}/knowledge${suffix}`);
  return data.entries || [];
}

export async function createKnowledge(brandId, entry) {
  return knowledgeRequest(`/api/brands/${encodeURIComponent(brandId)}/knowledge`, { method: "POST", body: JSON.stringify(entry) });
}

export async function updateKnowledge(brandId, entryId, updates) {
  return knowledgeRequest(`/api/brands/${encodeURIComponent(brandId)}/knowledge/${encodeURIComponent(entryId)}`, { method: "PUT", body: JSON.stringify(updates) });
}

export async function deleteKnowledge(brandId, entryId) {
  return knowledgeRequest(`/api/brands/${encodeURIComponent(brandId)}/knowledge/${encodeURIComponent(entryId)}`, { method: "DELETE" });
}

export async function uploadKnowledgeDocument(brandId, file) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/brands/${encodeURIComponent(brandId)}/knowledge/upload`, {
    method: "POST",
    headers: await authHeaders({ Accept: "application/json" }),
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}


export async function checkVisualBrand(brandId, file) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/brands/${encodeURIComponent(brandId)}/visual-check`, {
    method: "POST", headers: await authHeaders({ Accept: "application/json" }), body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data.result;
}
