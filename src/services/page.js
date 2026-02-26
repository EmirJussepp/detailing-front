export function unwrapPage(data) {
  if (Array.isArray(data)) {
    return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1 }
  }
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    page: Number(data?.page ?? 0),
    size: Number(data?.size ?? 10),
    totalElements: Number(data?.totalElements ?? 0),
    totalPages: Number(data?.totalPages ?? 1),
  }
}