import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://your-backend.example.com';

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
