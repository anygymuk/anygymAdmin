"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import Sidebar from "../../../components/Sidebar";

export default function CheckIn() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<"qr" | "code" | null>(null);
  const [passCode, setPassCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checkInData, setCheckInData] = useState<any>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const qrCodeRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  const handleCheckIn = useCallback(async (detectedCode: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setCheckInData(null);

    try {
      const response = await fetch("https://api.any-gym.com/admin/check_in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth0_id": user?.sub || "",
          "pass_code": detectedCode,
        },
      });

      if (!response.ok) {
        let errorMessage = `Check-in failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setCheckInData(data);
      setSuccess("Check-in successful!");
      
      // Stop scanning
      if (qrCodeRef.current) {
        await qrCodeRef.current.stop();
        await qrCodeRef.current.clear();
        qrCodeRef.current = null;
        setScanning(false);
      }

      // Generate QR code if not provided
      if (!data.qr_code && !data.qrCode && (data.pass_code || data.passCode || data.code)) {
        const passCode = data.pass_code || data.passCode || data.code;
        try {
          const qrDataUrl = await QRCode.toDataURL(passCode, {
            width: 200,
            margin: 2,
          });
          setCheckInData({ ...data, generated_qr_code: qrDataUrl });
        } catch (err) {
          console.error("Error generating QR code:", err);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process check-in. Please try again.";
      setError(errorMessage);
      console.error("Error checking in:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.sub]);

  const handlePassCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passCode.trim()) {
      setError("Please enter a pass code");
      return;
    }

    await handleCheckIn(passCode.trim());
    setPassCode("");
  };

  const handleCompleteCheckIn = async () => {
    if (!checkInData) return;

    const passCode = checkInData.pass_code || checkInData.passCode || checkInData.code;
    if (!passCode) {
      setCompleteError("Pass code not found");
      return;
    }

    setCompleting(true);
    setCompleteError(null);
    setCompleteSuccess(false);

    try {
      const response = await fetch("https://api.any-gym.com/admin/check_in/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth0_id": user?.sub || "",
          "pass_code": passCode,
        },
      });

      if (!response.ok) {
        let errorMessage = `Check-in completion failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setCompleteSuccess(true);
      setCompleteError(null);
      
      // Optionally update checkInData with new information
      if (data) {
        setCheckInData({ ...checkInData, ...data });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to complete check-in. Please try again.";
      setCompleteError(errorMessage);
      console.error("Error completing check-in:", err);
    } finally {
      setCompleting(false);
    }
  };

  // Initialize QR scanner
  useEffect(() => {
    if (activeMode === "qr" && scannerContainerRef.current && !qrCodeRef.current && !scanning && typeof window !== "undefined") {
      const startScanning = async () => {
        try {
          setScanning(true);
          setError(null);

          // Dynamically import html5-qrcode only on client side
          const { Html5Qrcode } = await import("html5-qrcode");
          const html5QrCode = new Html5Qrcode("qr-reader");
          qrCodeRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" }, // Use back camera
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            async (decodedText) => {
              // QR code detected
              await handleCheckIn(decodedText);
            },
            (errorMessage) => {
              // Ignore scanning errors (they're frequent during scanning)
            }
          );
        } catch (err) {
          console.error("Error starting QR scanner:", err);
          setError("Failed to start camera. Please check permissions.");
          setScanning(false);
          qrCodeRef.current = null;
        }
      };

      startScanning();
    }

    // Cleanup when component unmounts or mode changes
    return () => {
      if (qrCodeRef.current) {
        qrCodeRef.current
          .stop()
          .then(() => {
            qrCodeRef.current?.clear();
            qrCodeRef.current = null;
            setScanning(false);
          })
          .catch((err) => {
            console.error("Error stopping QR scanner:", err);
            qrCodeRef.current = null;
            setScanning(false);
          });
      }
    };
  }, [activeMode, scanning, handleCheckIn]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">Error: {authError.message}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/dashboard/check-in" />

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Check-in</h2>
              <p className="mt-2 text-sm text-gray-600">
                Scan a QR code or enter a pass code to check in
              </p>
            </div>

            {!activeMode ? (
              /* Selection Screen */
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* QR Code Option */}
                <button
                  onClick={() => setActiveMode("qr")}
                  className="relative group bg-white p-8 rounded-lg border-2 border-gray-300 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="rounded-lg bg-blue-50 p-4 mb-4 group-hover:bg-blue-100 transition-colors">
                      <svg
                        className="h-12 w-12 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 4.5h4.5v4.5h-4.5V4.5zM3.75 15h4.5v4.5h-4.5V15zM13.5 4.5h4.5v4.5h-4.5V4.5zM9 9h.008v.008H9V9zM15 9h.008v.008H15V9zM9 15h.008v.008H9V15zM15 15h.008v.008H15V15zM13.5 15h4.5v4.5h-4.5V15zM21 3v6M3 21h6M21 21v-6M3 3h6"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Scan QR Code
                    </h3>
                    <p className="text-sm text-gray-500">
                      Use your device camera to scan a QR code
                    </p>
                  </div>
                </button>

                {/* Enter Pass Code Option */}
                <button
                  onClick={() => setActiveMode("code")}
                  className="relative group bg-white p-8 rounded-lg border-2 border-gray-300 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="rounded-lg bg-blue-50 p-4 mb-4 group-hover:bg-blue-100 transition-colors">
                      <svg
                        className="h-12 w-12 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Enter Pass Code
                    </h3>
                    <p className="text-sm text-gray-500">
                      Manually enter a pass code to check in
                    </p>
                  </div>
                </button>
              </div>
            ) : activeMode === "qr" ? (
              /* QR Code Scanner */
              <div className="bg-white shadow rounded-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Scan QR Code</h3>
                  <button
                    onClick={async () => {
                      if (qrCodeRef.current) {
                        try {
                          await qrCodeRef.current.stop();
                          await qrCodeRef.current.clear();
                        } catch (err) {
                          console.error("Error stopping scanner:", err);
                        }
                        qrCodeRef.current = null;
                      }
                      setScanning(false);
                      setActiveMode(null);
                      setError(null);
                      setSuccess(null);
                      setCheckInData(null);
                      setCompleteError(null);
                      setCompleteSuccess(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    ← Back
                  </button>
                </div>

                {/* QR Scanner */}
                {!success && (
                  <div className="max-w-md mx-auto">
                    {!scanning && !error && (
                      <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center border-2 border-dashed border-gray-300">
                        <div className="text-center p-8">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                          <p className="text-sm text-gray-500">Starting camera...</p>
                        </div>
                      </div>
                    )}
                    <div
                      id="qr-reader"
                      ref={scannerContainerRef}
                      className={`rounded-lg overflow-hidden ${scanning && !success ? "" : "hidden"}`}
                    ></div>
                    {scanning && !success && (
                      <p className="mt-4 text-center text-sm text-gray-600">
                        Point your camera at a QR code
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-red-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {success && checkInData && (
                  <div className="mt-6">
                    {/* Pass Display - Matching the image style */}
                    <div className="bg-green-100 rounded-t-2xl p-6 max-w-md mx-auto border border-gray-200 shadow-lg">
                      {/* Gym Name */}
                      <h3 className="text-3xl font-bold text-gray-900 mb-4">
                        {checkInData.gym_name || checkInData.gymName || checkInData.location_name || "Gym"}
                      </h3>

                      {/* Valid Until */}
                      {(checkInData.valid_until || checkInData.validUntil || checkInData.expires_at || checkInData.expiresAt) && (
                        <div className="flex items-center text-gray-600 mb-6">
                          <svg
                            className="h-5 w-5 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-sm">
                            Valid until {new Date(checkInData.valid_until || checkInData.validUntil || checkInData.expires_at || checkInData.expiresAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Pass Code */}
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <p className="text-xs text-gray-500 mb-2">Pass Code</p>
                        <p className="text-xl font-bold text-gray-900">
                          {checkInData.pass_code || checkInData.passCode || checkInData.code || "N/A"}
                        </p>
                      </div>

                      {/* QR Code */}
                      {(checkInData.qr_code || checkInData.qrCode || checkInData.generated_qr_code) && (
                        <div className="bg-white rounded-lg p-4 flex justify-center">
                          <img
                            src={checkInData.qr_code || checkInData.qrCode || checkInData.generated_qr_code}
                            alt="QR Code"
                            className="w-64 h-64"
                          />
                        </div>
                      )}

                      {/* Check-in Button */}
                      {!completeSuccess && (
                        <div className="mt-6">
                          <button
                            onClick={handleCompleteCheckIn}
                            disabled={completing}
                            className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-6 py-3 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {completing ? (
                              <>
                                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Processing...
                              </>
                            ) : (
                              "Check In"
                            )}
                          </button>
                        </div>
                      )}

                      {/* Complete Success Message */}
                      {completeSuccess && (
                        <div className="mt-6 rounded-md bg-green-50 p-4 border border-green-200">
                          <div className="flex items-center">
                            <svg
                              className="h-5 w-5 text-green-400 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <p className="text-sm font-medium text-green-800">
                              Check-in completed successfully!
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Complete Error Message */}
                      {completeError && (
                        <div className="mt-6 rounded-md bg-red-50 p-4 border border-red-200">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg
                                className="h-5 w-5 text-red-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm text-red-800">{completeError}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Enter Pass Code Form */
              <div className="bg-white shadow rounded-lg p-8 max-w-md mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Enter Pass Code</h3>
                  <button
                    onClick={() => {
                      setActiveMode(null);
                      setPassCode("");
                      setError(null);
                      setSuccess(null);
                      setCheckInData(null);
                      setCompleteError(null);
                      setCompleteSuccess(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    ← Back
                  </button>
                </div>

                <form onSubmit={handlePassCodeSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="pass-code" className="block text-sm font-medium text-gray-700 mb-1">
                      Pass Code
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="text"
                        id="pass-code"
                        value={passCode}
                        onChange={(e) => setPassCode(e.target.value)}
                        placeholder="Enter pass code"
                        className="block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-red-400"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-800">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {success && checkInData && (
                    <div className="mt-6">
                      {/* Pass Display - Matching the image style */}
                      <div className="bg-green-100 rounded-t-2xl p-6 max-w-md mx-auto border border-gray-200 shadow-lg">
                        {/* Gym Name */}
                        <h3 className="text-3xl font-bold text-gray-900 mb-4">
                          {checkInData.gym_name || checkInData.gymName || checkInData.location_name || "Gym"}
                        </h3>

                        {/* Valid Until */}
                        {(checkInData.valid_until || checkInData.validUntil || checkInData.expires_at || checkInData.expiresAt) && (
                          <div className="flex items-center text-gray-600 mb-6">
                            <svg
                              className="h-5 w-5 mr-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-sm">
                              Valid until {new Date(checkInData.valid_until || checkInData.validUntil || checkInData.expires_at || checkInData.expiresAt).toLocaleString()}
                            </span>
                          </div>
                        )}

                        {/* Pass Code */}
                        <div className="bg-white rounded-lg p-4 mb-4">
                          <p className="text-xs text-gray-500 mb-2">Pass Code</p>
                          <p className="text-xl font-bold text-gray-900">
                            {checkInData.pass_code || checkInData.passCode || checkInData.code || "N/A"}
                          </p>
                        </div>

                        {/* QR Code */}
                        {(checkInData.qr_code || checkInData.qrCode || checkInData.generated_qr_code) && (
                          <div className="bg-white rounded-lg p-4 flex justify-center">
                            <img
                              src={checkInData.qr_code || checkInData.qrCode || checkInData.generated_qr_code}
                              alt="QR Code"
                              className="w-64 h-64"
                            />
                          </div>
                        )}

                        {/* Check-in Button */}
                        {!completeSuccess && (
                          <div className="mt-6">
                            <button
                              onClick={handleCompleteCheckIn}
                              disabled={completing}
                              className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-6 py-3 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {completing ? (
                                <>
                                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                  Processing...
                                </>
                              ) : (
                                "Check In"
                              )}
                            </button>
                          </div>
                        )}

                        {/* Complete Success Message */}
                        {completeSuccess && (
                          <div className="mt-6 rounded-md bg-green-50 p-4 border border-green-200">
                            <div className="flex items-center">
                              <svg
                                className="h-5 w-5 text-green-400 mr-2"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <p className="text-sm font-medium text-green-800">
                                Check-in completed successfully!
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Complete Error Message */}
                        {completeError && (
                          <div className="mt-6 rounded-md bg-red-50 p-4 border border-red-200">
                            <div className="flex">
                              <div className="flex-shrink-0">
                                <svg
                                  className="h-5 w-5 text-red-400"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <p className="text-sm text-red-800">{completeError}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <button
                      type="submit"
                      disabled={loading || !passCode.trim()}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Processing..." : "Check In"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

