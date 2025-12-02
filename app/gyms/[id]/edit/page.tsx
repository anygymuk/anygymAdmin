"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "../../../../components/Sidebar";
import Link from "next/link";

interface GymDetails {
  id: number;
  name: string;
  address: string;
  postcode: string;
  city: string;
  latitude: number | string;
  longitude: number | string;
  required_tier: string;
  amenities: string[];
  opening_hours: Record<string, { open: string; close: string } | string>;
  phone: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  status: string;
}

export default function EditGym() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const gymId = params?.id as string;

  const [gym, setGym] = useState<GymDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasWritePermission, setHasWritePermission] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    postcode: "",
    city: "",
    latitude: "",
    longitude: "",
    required_tier: "",
    amenities: [] as string[],
    opening_hours: {} as Record<string, { open: string; close: string }>,
    phone: "",
    image_url: "",
    status: "active",
  });

  // Track which fields have changed
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.sub && gymId) {
      checkUserPermissions();
      fetchGymDetails();
    }
  }, [user, gymId]);

  const checkUserPermissions = async () => {
    if (!user?.sub) return;

    try {
      const response = await fetch("https://api.any-gym.com/admin/user", {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const hasWrite = data.permission === "write" || data.permissions?.includes("write");
        setHasWritePermission(hasWrite);
        
        if (!hasWrite) {
          setError("You do not have permission to edit gyms");
        }
      }
    } catch (err) {
      console.error("Error checking user permissions:", err);
      setError("Failed to verify permissions");
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
        throw new Error(`Failed to fetch gym details: ${response.status}`);
      }

      const data = await response.json();
      setGym(data);
      
      // Initialize form data
      // Convert opening_hours from API format to form format
      const openingHours: Record<string, { open: string; close: string }> = {};
      if (data.opening_hours) {
        Object.entries(data.opening_hours).forEach(([day, hours]) => {
          if (typeof hours === "object" && hours !== null && "open" in hours && "close" in hours) {
            openingHours[day] = { open: hours.open, close: hours.close };
          } else {
            // If it's a string or other format, initialize with empty
            openingHours[day] = { open: "", close: "" };
          }
        });
      }
      
      const initialFormData = {
        name: data.name || "",
        address: data.address || "",
        postcode: data.postcode || "",
        city: data.city || "",
        latitude: data.latitude !== null && data.latitude !== undefined ? String(data.latitude) : "",
        longitude: data.longitude !== null && data.longitude !== undefined ? String(data.longitude) : "",
        required_tier: data.required_tier || "",
        amenities: data.amenities || [],
        opening_hours: openingHours,
        phone: data.phone || "",
        image_url: data.image_url || "",
        status: data.status || "active",
      };
      setFormData(initialFormData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch gym details";
      setError(errorMessage);
      console.error("Error fetching gym details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setChangedFields((prev) => new Set(prev).add(field));
    setSuccess(false);
  };

  const handleAmenityChange = (amenity: string, checked: boolean) => {
    setFormData((prev) => {
      const amenities = checked
        ? [...prev.amenities, amenity]
        : prev.amenities.filter((a) => a !== amenity);
      return { ...prev, amenities };
    });
    setChangedFields((prev) => new Set(prev).add("amenities"));
    setSuccess(false);
  };

  const handleOpeningHoursChange = (day: string, field: "open" | "close", value: string) => {
    setFormData((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: {
          ...(prev.opening_hours[day] || { open: "", close: "" }),
          [field]: value,
        },
      },
    }));
    setChangedFields((prev) => new Set(prev).add("opening_hours"));
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasWritePermission) {
      setError("You do not have permission to edit gyms");
      return;
    }

    if (changedFields.size === 0) {
      setError("No changes to save");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Build update payload with only changed fields
      // The UpdateAdminGymDto expects specific field names and data types
      const updatePayload: Record<string, any> = {};
      
      console.log("=== DEBUG: Building Update Payload ===");
      console.log("Changed fields set:", Array.from(changedFields));
      console.log("Changed fields size:", changedFields.size);
      
      changedFields.forEach((field) => {
        let value = formData[field as keyof typeof formData];
        console.log(`Processing field: ${field}, value:`, value, "type:", typeof value);
        
        // Convert data types to match API expectations
        if (field === "latitude" || field === "longitude") {
          // Convert to number if it's a valid number string
          const numValue = value ? parseFloat(value as string) : null;
          if (numValue !== null && !isNaN(numValue)) {
            updatePayload[field] = numValue;
            console.log(`  -> Added ${field} as number:`, numValue);
          } else if (value === "") {
            // Allow empty string to clear the value
            updatePayload[field] = null;
            console.log(`  -> Added ${field} as null`);
          } else {
            console.log(`  -> Skipped ${field} (invalid value)`);
          }
        } else if (field === "opening_hours") {
          // Ensure opening_hours is in the correct format
          // Include all days, even if empty (API might need the structure)
          const hours: Record<string, { open: string; close: string }> = {};
          const hoursValue = value as Record<string, { open: string; close: string }>;
          
          if (hoursValue && typeof hoursValue === 'object') {
            Object.entries(hoursValue).forEach(
              ([day, times]) => {
                if (times && typeof times === 'object') {
                  hours[day] = { 
                    open: times.open || "", 
                    close: times.close || "" 
                  };
                }
              }
            );
          }
          updatePayload[field] = hours;
          console.log(`  -> Added opening_hours:`, hours);
        } else if (field === "phone" && value === "") {
          // Allow empty phone to be null
          updatePayload[field] = null;
          console.log(`  -> Added phone as null`);
        } else if (field === "image_url" && value === "") {
          // Allow empty image_url to be null
          updatePayload[field] = null;
          console.log(`  -> Added image_url as null`);
        } else {
          updatePayload[field] = value;
          console.log(`  -> Added ${field}:`, value);
        }
      });

      console.log("Final update payload:", updatePayload);
      console.log("Final payload keys:", Object.keys(updatePayload));
      console.log("Final payload keys count:", Object.keys(updatePayload).length);

      // Ensure we have at least one field to update
      if (Object.keys(updatePayload).length === 0) {
        console.error("ERROR: No fields in update payload!");
        setError("No changes to save");
        setSaving(false);
        return;
      }

      // Ensure the payload is a plain object (not a class instance)
      const cleanPayload = JSON.parse(JSON.stringify(updatePayload));
      const requestBody = JSON.stringify(cleanPayload);
      
      console.log("Request body JSON:", requestBody);
      console.log("Request body length:", requestBody.length);
      console.log("Request body parsed back:", JSON.parse(requestBody));

      // Use Headers object to ensure exact case for custom headers
      // Note: Some browsers may normalize header names, so we'll use a plain object
      // but ensure the custom headers are lowercase
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "auth0_id": user?.sub || "",
        "gym_id": gymId,
      };
      
      console.log("Request headers:", headers);
      console.log("Full request details:", {
        method: "PUT",
        url: "https://api.any-gym.com/admin/gyms/update",
        headers,
        body: requestBody,
      });

      const response = await fetch("https://api.any-gym.com/admin/gyms/update", {
        method: "PUT",
        headers: headers,
        body: requestBody,
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `Failed to update gym: ${response.status} ${response.statusText}`;
        try {
          const errorText = await response.text();
          console.error("API Error Response:", errorText);
          
          // Try to parse as JSON for more detailed error
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            // If not JSON, use the text as is
            if (errorText) {
              errorMessage = errorText;
            }
          }
        } catch (err) {
          console.error("Error parsing error response:", err);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setSuccess(true);
      setChangedFields(new Set());
      
      // Optionally refresh gym data
      setTimeout(() => {
        fetchGymDetails();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update gym";
      setError(errorMessage);
      console.error("Error updating gym:", err);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
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

  if (!user || !hasWritePermission) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar currentPath="/gyms" />
        <div className="lg:pl-72">
          <main className="py-8">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900">
                  {!hasWritePermission ? "Access Denied" : "Please log in"}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {!hasWritePermission
                    ? "You do not have permission to edit gyms"
                    : "You must be logged in to edit gyms"}
                </p>
                <div className="mt-6">
                  <Link
                    href={`/gyms/${gymId}`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Back to Gym Details
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const commonAmenities = [
    "Free WiFi",
    "Parking",
    "Showers",
    "Locker Rooms",
    "Personal Training",
    "Group Classes",
    "Steam Room",
    "Cardio Equipment",
    "Weight Training",
    "Air Conditioning",
  ];

  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

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
                href={`/gyms/${gymId}`}
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
                Back to Gym Details
              </Link>
              <h2 className="text-3xl font-bold text-gray-900">
                Edit Gym: {gym?.name || "Loading..."}
              </h2>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-6 rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">
                      Gym updated successfully!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
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
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="status"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Status *
                    </label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => handleInputChange("status", e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="address"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Address *
                    </label>
                    <input
                      type="text"
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="postcode"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Postcode *
                    </label>
                    <input
                      type="text"
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => handleInputChange("postcode", e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="city"
                      className="block text-sm font-medium text-gray-700"
                    >
                      City *
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="latitude"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Latitude
                    </label>
                    <input
                      type="text"
                      id="latitude"
                      value={formData.latitude}
                      onChange={(e) => handleInputChange("latitude", e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="longitude"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Longitude
                    </label>
                    <input
                      type="text"
                      id="longitude"
                      value={formData.longitude}
                      onChange={(e) => handleInputChange("longitude", e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="required_tier"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Required Tier *
                    </label>
                    <select
                      id="required_tier"
                      value={formData.required_tier}
                      onChange={(e) => handleInputChange("required_tier", e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="elite">Elite</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="image_url"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Image URL
                    </label>
                    <input
                      type="url"
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => handleInputChange("image_url", e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Amenities
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {commonAmenities.map((amenity) => (
                    <div key={amenity} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`amenity-${amenity}`}
                        checked={formData.amenities.includes(amenity)}
                        onChange={(e) =>
                          handleAmenityChange(amenity, e.target.checked)
                        }
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor={`amenity-${amenity}`}
                        className="ml-2 text-sm text-gray-700"
                      >
                        {amenity}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opening Hours */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Opening Hours
                </h3>
                <div className="space-y-4">
                  {daysOfWeek.map((day) => {
                    const hours = formData.opening_hours[day] || { open: "", close: "" };
                    return (
                      <div key={day} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                        <label className="text-sm font-medium text-gray-700 capitalize">
                          {day}
                        </label>
                        <div>
                          <label
                            htmlFor={`hours-${day}-open`}
                            className="block text-xs text-gray-500 mb-1"
                          >
                            Open
                          </label>
                          <input
                            type="time"
                            id={`hours-${day}-open`}
                            value={hours.open}
                            onChange={(e) =>
                              handleOpeningHoursChange(day, "open", e.target.value)
                            }
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`hours-${day}-close`}
                            className="block text-xs text-gray-500 mb-1"
                          >
                            Close
                          </label>
                          <input
                            type="time"
                            id={`hours-${day}-close`}
                            value={hours.close}
                            onChange={(e) =>
                              handleOpeningHoursChange(day, "close", e.target.value)
                            }
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                        <div className="text-xs text-gray-500">
                          {hours.open && hours.close
                            ? `${hours.open} - ${hours.close}`
                            : "Closed"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3">
                <Link
                  href={`/gyms/${gymId}`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving || changedFields.size === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

