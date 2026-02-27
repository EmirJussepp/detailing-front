export function buildPageQuery({
  page = 0,
  size = 10,
  search = "",
  sort = "",
  dir = "desc",
  extra = {},
} = {}) {
  const params = {
    page,
    size,
  }

  const s = String(search || "").trim()
  if (s) params.search = s

  const so = String(sort || "").trim()
  if (so) params.sort = so

  const d = String(dir || "").toLowerCase()
  if (d === "asc" || d === "desc") params.dir = d

  // extra filtros (solo si tienen valor)
  Object.entries(extra || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return
    params[k] = v
  })

  return params
}

export function unwrapPage(resData) {
  // Soporta: PageResponse { content, page, size, totalPages, totalElements }
  if (resData && Array.isArray(resData.content)) return resData
  // Por las dudas si algún endpoint todavía devuelve array
  if (Array.isArray(resData)) {
    return {
      content: resData,
      page: 0,
      size: resData.length,
      totalPages: 1,
      totalElements: resData.length,
    }
  }
  return {
    content: [],
    page: 0,
    size: 10,
    totalPages: 1,
    totalElements: 0,
  }
}