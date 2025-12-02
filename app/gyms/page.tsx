"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";

interface Gym {
  id: string;
  name: string;
  address: string;
  postcode: string;
  city: string;
  required_tier: string;
}

interface PaginationMeta {
  page: number;
  totalPages?: number;
  total?: number;
  limit?: number;
}

export default function Gyms() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGyms = useCallback(async (page: number, search: string) => {
    if (!user?.sub) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Ensure page is always at least 1
      const pageNum = Math.max(1, page);
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append("page", pageNum.toString());
      
      // Add search parameter if provided
      if (search && search.trim()) {
        params.append("search", search.trim());
      }

      const url = `https://api.any-gym.com/admin/gyms?${params.toString()}`;
      console.log("Fetching gyms from:", url);

      const response = await fetch(url, {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch gyms: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);
      
      // Handle different response formats
      if (Array.isArray(data)) {
        setGyms(data);
        setPagination({ page: pageNum });
      } else if (data.results && Array.isArray(data.results)) {
        // Response format: { results: [...], pagination: { total_results, page, result_set } }
        setGyms(data.results);
        const paginationData = data.pagination || {};
        const totalResults = paginationData.total_results || 0;
        const limit = 20; // Default limit, can be extracted from result_set if needed
        const totalPages = Math.ceil(totalResults / limit);
        
        setPagination({
          page: paginationData.page || pageNum,
          totalPages: totalPages,
          total: totalResults,
          limit: limit,
        });
      } else if (data.data && Array.isArray(data.data)) {
        // Response format: { data: [...], page, totalPages, total }
        setGyms(data.data);
        setPagination({
          page: data.page || pageNum,
          totalPages: data.totalPages,
          total: data.total,
          limit: data.limit,
        });
      } else {
        console.warn("Unexpected response format:", data);
        setGyms([]);
        setPagination({ page: pageNum });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch gyms";
      setError(errorMessage);
      console.error("Error fetching gyms:", err);
      setGyms([]);
    } finally {
      setLoading(false);
    }
  }, [user?.sub]);

  // Fetch gyms when page, search, or user changes
  useEffect(() => {
    if (user?.sub) {
      fetchGyms(currentPage, debouncedSearch);
    }
  }, [user?.sub, currentPage, debouncedSearch, fetchGyms]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/gyms" />

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Gyms</h2>
              <p className="mt-2 text-sm text-gray-600">
                Manage and view all gym locations
              </p>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by gym name or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Prevent form submission on Enter key
                    if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
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
            {loading && gyms.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-600">Loading gyms...</p>
              </div>
            ) : gyms.length === 0 ? (
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {debouncedSearch ? "No gyms found" : "No gyms available"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {debouncedSearch
                    ? `No gyms match your search for "${debouncedSearch}"`
                    : "Get started by adding a new gym location."}
                </p>
              </div>
            ) : (
              <>
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
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Name
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Address
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Postcode
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            City
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Required Tier
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {gyms.map((gym) => (
                          <tr key={gym.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {gym.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{gym.address}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{gym.postcode}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{gym.city}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {gym.required_tier}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link
                                href={`/gyms/${gym.id}`}
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

                {/* Pagination Controls */}
                {(pagination.totalPages !== undefined || gyms.length > 0) && (
                  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || loading}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            pagination.totalPages
                              ? Math.min(pagination.totalPages, prev + 1)
                              : prev + 1
                          )
                        }
                        disabled={
                          (pagination.totalPages !== undefined &&
                            currentPage >= pagination.totalPages) ||
                          loading
                        }
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing{" "}
                          <span className="font-medium">
                            {gyms.length > 0
                              ? (currentPage - 1) * (pagination.limit || 20) + 1
                              : 0}
                          </span>{" "}
                          to{" "}
                          <span className="font-medium">
                            {(currentPage - 1) * (pagination.limit || 20) + gyms.length}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium">
                            {pagination.total || "many"}
                          </span>{" "}
                          results
                          {debouncedSearch && ` for "${debouncedSearch}"`}
                        </p>
                      </div>
                      <div>
                        <nav
                          className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                          aria-label="Pagination"
                        >
                          <button
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1 || loading}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Previous</span>
                            <svg
                              className="h-5 w-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          {pagination.totalPages !== undefined &&
                            Array.from(
                              { length: Math.min(5, pagination.totalPages) },
                              (_, i) => {
                                let pageNum;
                                if (pagination.totalPages! <= 5) {
                                  pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (
                                  currentPage >=
                                  pagination.totalPages! - 2
                                ) {
                                  pageNum = pagination.totalPages! - 4 + i;
                                } else {
                                  pageNum = currentPage - 2 + i;
                                }
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    disabled={loading}
                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                      currentPage === pageNum
                                        ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              }
                            )}
                          <button
                            onClick={() =>
                              setCurrentPage((prev) =>
                                pagination.totalPages
                                  ? Math.min(pagination.totalPages, prev + 1)
                                  : prev + 1
                              )
                            }
                            disabled={
                              (pagination.totalPages !== undefined &&
                                currentPage >= pagination.totalPages) ||
                              loading
                            }
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Next</span>
                            <svg
                              className="h-5 w-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

