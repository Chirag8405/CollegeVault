import { RequestHandler } from "express";
import { ApiResponse } from "@shared/api";

// System health check endpoint
export const handleHealthCheck: RequestHandler = (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: "College Vault API is running",
  };
  res.status(200).json(response);
};
