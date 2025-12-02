"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "../../../components/Sidebar";

interface Member {
  id: string;
  [key: string]: any; // Allow for flexible member structure
}

export default function Members() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  const fetchMembers = useCallback(async () => {
    if (!user?.sub) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = "https://api.any-gym.com/admin/members";
      console.log("Fetching members from:", url);

      const response = await fetch(url, {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch members: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);

      // Handle different response formats
      if (Array.isArray(data)) {
        setMembers(data);
      } else if (data.results && Array.isArray(data.results)) {
        setMembers(data.results);
      } else if (data.data && Array.isArray(data.data)) {
        setMembers(data.data);
      } else {
        console.warn("Unexpected response format:", data);
        setMembers([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch members";
      setError(errorMessage);
      console.error("Error fetching members:", err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [user?.sub]);

  // Fetch members when user changes
  useEffect(() => {
    if (user?.sub) {
      fetchMembers();
    }
  }, [user?.sub, fetchMembers]);

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

  // Get table columns from the first member if available
  const getTableColumns = () => {
    if (members.length === 0) return [];
    
    const firstMember = members[0];
    const columns = Object.keys(firstMember);
    
    // Prioritize common member fields
    const importantFields = ['id', 'name', 'email', 'phone', 'created_at', 'updated_at', 'status', 'tier', 'membership_type'];
    const sortedColumns = [
      ...importantFields.filter(field => columns.includes(field)),
      ...columns.filter(field => !importantFields.includes(field))
    ];
    
    return sortedColumns.slice(0, 10); // Limit to 10 columns for readability
  };

  const columns = getTableColumns();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/dashboard/members" />

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Members</h2>
              <p className="mt-2 text-sm text-gray-600">
                View and manage all members
              </p>
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
            {loading && members.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-600">Loading members...</p>
              </div>
            ) : members.length === 0 ? (
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No members available
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  There are no members to display at this time.
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
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {members.map((member) => (
                        <tr key={member.id || JSON.stringify(member)} className="hover:bg-gray-50">
                          {columns.map((column) => {
                            const value = member[column];
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
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/dashboard/members/${member.member_auth0_id || member.auth0_id || member.id}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

