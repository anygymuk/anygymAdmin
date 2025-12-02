"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "../../../components/Sidebar";
import Link from "next/link";

interface GymDetails {
  id: number;
  name: string;
  address: string;
  postcode: string;
  city: string;
  latitude: string;
  longitude: string;
  required_tier: string;
  amenities: string[];
  opening_hours: Record<string, any>;
  phone: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  status: string;
}

export default function GymDetail() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const gymId = params?.id as string;

  const [gym, setGym] = useState<GymDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  const checkUserPermissions = async () => {
    if (!user?.sub) return;

    try {
      setCheckingPermission(true);
      const response = await fetch("https://api.any-gym.com/admin/user", {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Check if user has write permission
        setHasWritePermission(data.permission === "write" || data.permissions?.includes("write"));
      }
    } catch (err) {
      console.error("Error checking user permissions:", err);
      setHasWritePermission(false);
    } finally {
      setCheckingPermission(false);
    }
  };

  const fetchGymDetails = async () => {
    if (!gymId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `https://api.any-gym.com/admin/gyms/${gymId}`,
        {
          headers: {
            "auth0_id": user?.sub || "",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Gym not found");
        }
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch gym details: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setGym(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch gym details";
      setError(errorMessage);
      console.error("Error fetching gym details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.sub && gymId) {
      fetchGymDetails();
      checkUserPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sub, gymId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading gym details...</p>
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar currentPath="/gyms" />
        <div className="lg:pl-72">
          <main className="py-8">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">{error}</h3>
                <div className="mt-6">
                  <Link
                    href="/gyms"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Back to Gyms
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!gym) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/gyms" />

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-6">
              <Link
                href="/gyms"
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Gyms
              </Link>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{gym.name}</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Gym ID: {gym.id} • {gym.city}
                  </p>
                </div>
                {hasWritePermission && (
                  <Link
                    href={`/gyms/${gym.id}/edit`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Information */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Basic Information
                  </h3>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{gym.address}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Postcode</dt>
                      <dd className="mt-1 text-sm text-gray-900">{gym.postcode}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">City</dt>
                      <dd className="mt-1 text-sm text-gray-900">{gym.city}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {gym.phone || "Not provided"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            gym.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {gym.status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Required Tier</dt>
                      <dd className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {gym.required_tier}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Location */}
                {(gym.latitude && gym.longitude) && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Location
                    </h3>
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Latitude</dt>
                        <dd className="mt-1 text-sm text-gray-900">{gym.latitude}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Longitude</dt>
                        <dd className="mt-1 text-sm text-gray-900">{gym.longitude}</dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <a
                        href={`https://www.google.com/maps?q=${gym.latitude},${gym.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                      >
                        View on Google Maps
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {gym.amenities && gym.amenities.length > 0 && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Amenities
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {gym.amenities.map((amenity, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opening Hours */}
                {gym.opening_hours && Object.keys(gym.opening_hours).length > 0 && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Opening Hours
                    </h3>
                    <dl className="space-y-2">
                      {Object.entries(gym.opening_hours).map(([day, hours]) => (
                        <div key={day} className="flex justify-between">
                          <dt className="text-sm font-medium text-gray-500 capitalize">
                            {day}
                          </dt>
                          <dd className="text-sm text-gray-900">
                            {hours ? String(hours) : "Closed"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Image */}
                {gym.image_url && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Image
                    </h3>
                    <img
                      src={gym.image_url}
                      alt={gym.name}
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Metadata
                  </h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Created At
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(gym.created_at).toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Updated At
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(gym.updated_at).toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

