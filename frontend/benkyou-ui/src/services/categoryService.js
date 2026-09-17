import { apiRequest } from "../api/client";

export function getCategories() {
  return apiRequest("categories");
}

export function createCategory(payload) {
  return apiRequest("categories", {
    method: "POST",
    body: payload,
  });
}

export function updateCategory(id, payload) {
  return apiRequest(`categories/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteCategory(id) {
  return apiRequest(`categories/${id}`, {
    method: "DELETE",
  });
}

