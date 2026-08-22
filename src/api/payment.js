import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function initPayment(userId, serviceId, montant) {
  const response = await axios.post(`${API_BASE}/api/payment/init`, {
    userId,
    serviceId,
    montant,
  });
  return response.data; // { paymentUrl, transactionId }
}

export async function checkPaymentStatus(transactionId) {
  const response = await axios.get(`${API_BASE}/api/payment/status/${transactionId}`);
  return response.data; // { statut, subscriberId }
}