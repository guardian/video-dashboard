export function formatDate(moment) {
  return moment.format('YYYY-MM-DD');
}

export function buildQS(o) {
    return Object.keys(o).filter(key => o[key]).map(key => `${key}=${o[key]}`).join('&');
}