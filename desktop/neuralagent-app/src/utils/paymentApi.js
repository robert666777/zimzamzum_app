import axios from "./axios";

// Payment API functions
export const paymentApi = {
  // Get current user's plan
  getUserPlan: async (accessToken) => {
    try {
      const response = await axios.get("/payments/user/plan", {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      return response.data;
    } catch (error) {
      console.error("Error getting user plan:", error);
      return { plan_id: 'free', plan: null, is_trial: true, expires_at: null };
    }
  },

  // Get all available plans
  getPlans: async (accessToken) => {
    try {
      const response = await axios.get("/payments/plans", {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      return response.data;
    } catch (error) {
      console.error("Error getting plans:", error);
      return [];
    }
  },

  // Create a payment request
  createPaymentRequest: async (planId, paymentMethod, accessToken) => {
    try {
      const response = await axios.post("/payments/payment-request", {
        plan_id: planId,
        payment_method: paymentMethod
      }, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      return response.data;
    } catch (error) {
      console.error("Error creating payment request:", error);
      throw error;
    }
  },

  // Get user's payment requests
  getUserPaymentRequests: async (accessToken) => {
    try {
      const response = await axios.get("/payments/payment-requests", {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      return response.data;
    } catch (error) {
      console.error("Error getting payment requests:", error);
      return [];
    }
  },

  // Admin: Get all payment requests
  getAllPaymentRequests: async (accessToken) => {
    try {
      const response = await axios.get("/payments/admin/payment-requests", {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      return response.data;
    } catch (error) {
      console.error("Error getting all payment requests:", error);
      return [];
    }
  },

  // Admin: Approve a payment request
  approvePayment: async (paymentId, accessToken) => {
    try {
      const response = await axios.post(`/payments/admin/approve-payment/${paymentId}`, null, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      return response.data;
    } catch (error) {
      console.error("Error approving payment:", error);
      throw error;
    }
  },

  // Admin: Reject a payment request
  rejectPayment: async (paymentId, notes, accessToken) => {
    try {
      const response = await axios.post(`/payments/admin/reject-payment/${paymentId}`, null, {
        headers: { 'Authorization': 'Bearer ' + accessToken },
        params: { admin_notes: notes }
      });
      return response.data;
    } catch (error) {
      console.error("Error rejecting payment:", error);
      throw error;
    }
  }
};

export default paymentApi;
