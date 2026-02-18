export function normStr(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function onlyDigits(s) {
  return String(s ?? "").replace(/\D+/g, "")
}

export function looksLikeCode(s) {
  const v = String(s ?? "").trim()
  return /^[A-Za-z0-9_-]{3,}$/.test(v)
}
