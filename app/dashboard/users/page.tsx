"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "../../../components/Sidebar";

interface AdminUser {
  id: string;
  [key: string]: any; // Allow for flexible user structure
}

interface Gym {
  id: string;
  name: string;
  [key: string]: any;
}

interface CurrentUserInfo {
  role?: string;
  gym_chain_id?: string;
  access_gyms?: string[];
}

export default function UserManagement() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState<CurrentUserInfo | null>(null);
  const [availableGyms, setAvailableGyms] = useState<Gym[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "gym_admin",
    permission: "read",
    access_gyms: [] as string[],
    name: "",
  });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  const fetchUsers = useCallback(async () => {
    if (!user?.sub) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = "https://api.any-gym.com/admin/user_list";
      console.log("Fetching users from:", url);

      const response = await fetch(url, {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);

      // Handle different response formats
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data.results && Array.isArray(data.results)) {
        setUsers(data.results);
      } else if (data.data && Array.isArray(data.data)) {
        setUsers(data.data);
      } else {
        console.warn("Unexpected response format:", data);
        setUsers([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch users";
      setError(errorMessage);
      console.error("Error fetching users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user?.sub]);

  // Fetch current user info and available gyms
  const fetchCurrentUserInfo = useCallback(async () => {
    if (!user?.sub) return;

    try {
      const response = await fetch("https://api.any-gym.com/admin/user", {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUserInfo({
          role: data.role || data.roles?.[0],
          gym_chain_id: data.gym_chain_id,
          access_gyms: data.access_gyms || [],
        });
      }
    } catch (err) {
      console.error("Error fetching current user info:", err);
    }
  }, [user?.sub]);

  const fetchAvailableGyms = useCallback(async () => {
    if (!user?.sub || !currentUserInfo) return;

    try {
      setLoadingGyms(true);
      let gymsToFetch: Gym[] = [];

      if (currentUserInfo.role === "admin") {
        // Fetch all gyms (they should be filtered by gym_chain_id on backend)
        const response = await fetch("https://api.any-gym.com/admin/gyms", {
          headers: {
            "auth0_id": user.sub,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            gymsToFetch = data;
          } else if (data.results && Array.isArray(data.results)) {
            gymsToFetch = data.results;
          } else if (data.data && Array.isArray(data.data)) {
            gymsToFetch = data.data;
          }
        }
      } else if (currentUserInfo.role === "gym_admin" && currentUserInfo.access_gyms) {
        // Fetch specific gyms from access_gyms array
        const gymPromises = currentUserInfo.access_gyms.map(async (gymId) => {
          try {
            const response = await fetch(`https://api.any-gym.com/admin/gyms/${gymId}`, {
              headers: {
                "auth0_id": user.sub,
              },
            });
            if (response.ok) {
              return await response.json();
            }
          } catch (err) {
            console.error(`Error fetching gym ${gymId}:`, err);
          }
          return null;
        });

        const gymResults = await Promise.all(gymPromises);
        gymsToFetch = gymResults.filter((gym) => gym !== null) as Gym[];
      }

      setAvailableGyms(gymsToFetch);
    } catch (err) {
      console.error("Error fetching available gyms:", err);
    } finally {
      setLoadingGyms(false);
    }
  }, [user?.sub, currentUserInfo]);

  // Fetch users when user changes
  useEffect(() => {
    if (user?.sub) {
      fetchUsers();
      fetchCurrentUserInfo();
    }
  }, [user?.sub, fetchUsers, fetchCurrentUserInfo]);

  // Fetch gyms when current user info changes
  useEffect(() => {
    if (currentUserInfo && showCreateModal) {
      fetchAvailableGyms();
    }
  }, [currentUserInfo, showCreateModal, fetchAvailableGyms]);

  // Only show full-page loading on initial auth load
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

  // Get table columns from the first user if available
  const getTableColumns = () => {
    if (users.length === 0) return [];
    
    const firstUser = users[0];
    const columns = Object.keys(firstUser);
    
    // Prioritize common user fields
    const importantFields = ['id', 'auth0_id', 'email', 'name', 'role', 'permission', 'created_at', 'updated_at', 'status'];
    const sortedColumns = [
      ...importantFields.filter(field => columns.includes(field)),
      ...columns.filter(field => !importantFields.includes(field))
    ];
    
    return sortedColumns.slice(0, 10); // Limit to 10 columns for readability
  };

  const columns = getTableColumns();

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    if (password.length < 10) return false;
    if (!/\d/.test(password)) return false; // At least one number
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false; // At least one special character
    return true;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (!validatePassword(formData.password)) {
      errors.password = "Password must be at least 10 characters with at least one number and one special character";
    }

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      setCreateSuccess(false);

      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        permission: formData.permission,
        access_gyms: formData.access_gyms,
        name: formData.name.trim(),
      };

      const response = await fetch("https://api.any-gym.com/admin/user/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth0_id": user?.sub || "",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to create user: ${response.status} ${response.statusText}`);
      }

      setCreateSuccess(true);
      // Reset form
      setFormData({
        email: "",
        password: "",
        role: "gym_admin",
        permission: "read",
        access_gyms: [],
        name: "",
      });
      setValidationErrors({});

      // Refresh users list
      await fetchUsers();

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateSuccess(false);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create user";
      setCreateError(errorMessage);
      console.error("Error creating user:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleGymToggle = (gymId: string) => {
    setFormData((prev) => ({
      ...prev,
      access_gyms: prev.access_gyms.includes(gymId)
        ? prev.access_gyms.filter((id) => id !== gymId)
        : [...prev.access_gyms, gymId],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/dashboard/users" />

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">User Management</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Manage admin users and their permissions
                </p>
              </div>
              <button
                onClick={() => {
                  setFormData({
                    email: "",
                    password: "",
                    role: "gym_admin",
                    permission: "read",
                    access_gyms: [],
                    name: "",
                  });
                  setValidationErrors({});
                  setCreateError(null);
                  setCreateSuccess(false);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Create New User
              </button>
            </div>

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

            {/* Loading overlay for table updates */}
            {loading && users.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-600">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No users available
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  There are no users to display at this time.
                </p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden relative">
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-xs text-gray-600">Updating...</p>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column}
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {column.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((adminUser) => (
                        <tr key={adminUser.id || JSON.stringify(adminUser)} className="hover:bg-gray-50">
                          {columns.map((column) => {
                            const value = adminUser[column];
                            let displayValue: React.ReactNode = value;

                            // Format different value types
                            if (value === null || value === undefined) {
                              displayValue = <span className="text-gray-400">-</span>;
                            } else if (typeof value === "boolean") {
                              displayValue = (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {value ? "Yes" : "No"}
                                </span>
                              );
                            } else if (typeof value === "object") {
                              displayValue = (
                                <span className="text-gray-500 text-xs">
                                  {JSON.stringify(value).substring(0, 50)}
                                  {JSON.stringify(value).length > 50 ? "..." : ""}
                                </span>
                              );
                            } else if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                              // Format date strings
                              try {
                                const date = new Date(value);
                                displayValue = date.toLocaleDateString();
                              } catch {
                                displayValue = value;
                              }
                            }

                            return (
                              <td key={column} className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{displayValue}</div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    onClick={() => {
                      if (!creating) {
                        setShowCreateModal(false);
                        setCreateError(null);
                        setCreateSuccess(false);
                        setValidationErrors({});
                      }
                    }}
                  ></div>

                  <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                    <form onSubmit={handleSubmit}>
                      <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                          Create New User
                        </h3>

                        {/* Success Message */}
                        {createSuccess && (
                          <div className="mb-4 rounded-md bg-green-50 p-4">
                            <p className="text-sm text-green-800">User created successfully!</p>
                          </div>
                        )}

                        {/* Error Message */}
                        {createError && (
                          <div className="mb-4 rounded-md bg-red-50 p-4">
                            <p className="text-sm text-red-800">{createError}</p>
                          </div>
                        )}

                        <div className="space-y-4">
                          {/* Name */}
                          <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                validationErrors.name ? "border-red-300" : ""
                              }`}
                            />
                            {validationErrors.name && (
                              <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                            )}
                          </div>

                          {/* Email */}
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                              Email <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="email"
                              id="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                validationErrors.email ? "border-red-300" : ""
                              }`}
                            />
                            {validationErrors.email && (
                              <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                            )}
                          </div>

                          {/* Password */}
                          <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                              Password <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="password"
                              id="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                                validationErrors.password ? "border-red-300" : ""
                              }`}
                            />
                            {validationErrors.password && (
                              <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                              Must be at least 10 characters with at least one number and one special character
                            </p>
                          </div>

                          {/* Role */}
                          <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                              Role <span className="text-red-500">*</span>
                            </label>
                            <select
                              id="role"
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="gym_admin">Gym Admin</option>
                              <option value="gym_staff">Gym Staff</option>
                            </select>
                          </div>

                          {/* Permission */}
                          <div>
                            <label htmlFor="permission" className="block text-sm font-medium text-gray-700">
                              Permission <span className="text-red-500">*</span>
                            </label>
                            <select
                              id="permission"
                              value={formData.permission}
                              onChange={(e) => setFormData({ ...formData, permission: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="read">Read</option>
                              <option value="write">Write</option>
                            </select>
                          </div>

                          {/* Access Gyms */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Access Gyms
                            </label>
                            {loadingGyms ? (
                              <div className="text-sm text-gray-500">Loading gyms...</div>
                            ) : availableGyms.length === 0 ? (
                              <div className="text-sm text-gray-500">No gyms available</div>
                            ) : (
                              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2">
                                {availableGyms.map((gym) => (
                                  <label
                                    key={gym.id}
                                    className="flex items-center py-2 px-3 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.access_gyms.includes(gym.id)}
                                      onChange={() => handleGymToggle(gym.id)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">{gym.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={creating}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {creating ? "Creating..." : "Create User"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateModal(false);
                            setCreateError(null);
                            setCreateSuccess(false);
                            setValidationErrors({});
                          }}
                          disabled={creating}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

