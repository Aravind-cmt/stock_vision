import axios from 'axios';

// Prefer Vite env var, then CRA-style env, then fall back to localhost for dev
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  || process.env.REACT_APP_API_BASE
  || 'http://127.0.0.1:8000';

export async function predict(features) {
  const url = `${API_BASE}/predict`;
  const res = await axios.post(url, { features });
  return res.data;
}

export async function uploadCsv(file, predict = false) {
  const url = `${API_BASE}/upload-csv`;
  const fd = new FormData();
  fd.append('file', file);
  const res = await axios.post(url, fd, { params: { predict }, headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
}
