"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Sidebar from "../../components/Sidebar";

interface RevenueData {
  [key: string]: any;
}

interface Location {
  id: string | number;
  name: string;
  gym_id?: number;
  gym_name?: string;
  [key: string]: any;
}

export default function Revenue() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get default dates: first day of current month and today
  const getDefaultFromDate = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split("T")[0]; // yyyy-mm-dd format
  };

  const getDefaultToDate = () => {
    const now = new Date();
    return now.toISOString().split("T")[0]; // yyyy-mm-dd format
  };

  const [fromDate, setFromDate] = useState<string>(getDefaultFromDate());
  const [toDate, setToDate] = useState<string>(getDefaultToDate());
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date | null>(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [gyms, setGyms] = useState<Location[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string | number | null>(null);
  const [loadingGyms, setLoadingGyms] = useState(false);
  const [passesPage, setPassesPage] = useState(1);
  const [passesPagination, setPassesPagination] = useState<{
    total?: number;
    totalPages?: number;
    limit?: number;
  }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  const fetchLocations = useCallback(async () => {
    if (!user?.sub) {
      return;
    }

    try {
      setLoadingGyms(true);
      const url = "https://api.any-gym.com/admin/locations";
      console.log("Fetching locations from:", url);

      const response = await fetch(url, {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch locations: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Locations API Response:", data);
      console.log("Locations API Response type:", typeof data);
      console.log("Locations API Response isArray:", Array.isArray(data));

      // Handle different response formats
      let locationsArray: Location[] = [];
      
      if (Array.isArray(data)) {
        locationsArray = data;
      } else if (data.results && Array.isArray(data.results)) {
        locationsArray = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        locationsArray = data.data;
      } else if (data.locations && Array.isArray(data.locations)) {
        locationsArray = data.locations;
      } else {
        console.warn("Unexpected locations response format:", data);
        console.warn("Response keys:", Object.keys(data));
        locationsArray = [];
      }
      
      console.log("Parsed locations array:", locationsArray);
      console.log("Number of locations:", locationsArray.length);
      if (locationsArray.length > 0) {
        console.log("First location:", locationsArray[0]);
        console.log("First location keys:", Object.keys(locationsArray[0]));
      }
      
      setGyms(locationsArray);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch locations";
      console.error("Error fetching locations:", err);
      console.error("Error details:", errorMessage);
      setGyms([]);
    } finally {
      setLoadingGyms(false);
    }
  }, [user?.sub]);

  const fetchRevenue = useCallback(async () => {
    if (!user?.sub) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      params.append("from_date", fromDate);
      params.append("to_date", toDate);
      
      // Add gym_id if a gym is selected
      if (selectedGymId !== null) {
        params.append("gym_id", selectedGymId.toString());
      }
      
      // Add passes pagination parameters
      params.append("passes_page", passesPage.toString());
      params.append("passes_per_page", "20");

      const url = `https://api.any-gym.com/admin/revenue?${params.toString()}`;
      console.log("Fetching revenue from:", url);

      const response = await fetch(url, {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch revenue: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);
      console.log("Passes data:", data.passes);
      console.log("Revenue data:", data.revenue);

      // Extract revenue object from response
      let revenue: RevenueData | null = null;
      if (data.revenue) {
        revenue = data.revenue;
      } else if (data) {
        // If the response itself is the revenue object
        revenue = data;
      }
      
      // Handle passes - it might be in revenue.passes or data.passes
      // According to the API, passes is at the top level (data.passes)
      let passesArray: any[] | null = null;
      let passesPaginationData: any = null;
      
      // Check if passes is at top level (primary location based on API response)
      if (data.passes) {
        if (Array.isArray(data.passes)) {
          passesArray = data.passes;
        } else if (typeof data.passes === 'object') {
          // If passes is an object with results array (common pagination pattern)
          if (data.passes.results && Array.isArray(data.passes.results)) {
            passesArray = data.passes.results;
            passesPaginationData = {
              total: data.passes.total,
              totalPages: data.passes.totalPages,
              limit: data.passes.limit || 20,
            };
          } else if (data.passes.data && Array.isArray(data.passes.data)) {
            passesArray = data.passes.data;
            passesPaginationData = {
              total: data.passes.total,
              totalPages: data.passes.totalPages,
              limit: data.passes.limit || 20,
            };
          } else {
            // Passes object might have pagination metadata
            passesPaginationData = {
              total: data.passes.total,
              totalPages: data.passes.totalPages,
              limit: data.passes.limit || 20,
            };
          }
        }
      }
      
      // Check if passes is in revenue object (fallback)
      if (!passesArray && revenue?.passes) {
        if (Array.isArray(revenue.passes)) {
          passesArray = revenue.passes;
        } else if (typeof revenue.passes === 'object') {
          if (revenue.passes.results && Array.isArray(revenue.passes.results)) {
            passesArray = revenue.passes.results;
            passesPaginationData = {
              total: revenue.passes.total,
              totalPages: revenue.passes.totalPages,
              limit: revenue.passes.limit || 20,
            };
          } else if (revenue.passes.data && Array.isArray(revenue.passes.data)) {
            passesArray = revenue.passes.data;
            passesPaginationData = {
              total: revenue.passes.total,
              totalPages: revenue.passes.totalPages,
              limit: revenue.passes.limit || 20,
            };
          }
        }
      }
      
      // Preserve total_passes before modifying passes
      const totalPassesValue = revenue?.total_passes;
      
      // Set passes array in revenue if we found it
      if (passesArray && revenue) {
        revenue.passes = passesArray;
        // Ensure total_passes is preserved and is a number
        if (totalPassesValue !== undefined) {
          // If total_passes was accidentally set to an array/object, restore it from the original
          if (Array.isArray(totalPassesValue) || (typeof totalPassesValue === 'object' && totalPassesValue !== null)) {
            // Try to get the actual number from the original data
            const originalTotalPasses = data.revenue?.total_passes || data.total_passes;
            if (originalTotalPasses !== undefined && typeof originalTotalPasses === 'number') {
              revenue.total_passes = originalTotalPasses;
            } else {
              // Fallback: use passes array length if available
              revenue.total_passes = passesArray.length;
            }
          } else {
            // Preserve the original value if it's a valid number
            revenue.total_passes = totalPassesValue;
          }
        }
      }
      
      console.log("Final revenue.total_passes:", revenue?.total_passes);
      console.log("Final revenue.passes type:", Array.isArray(revenue?.passes) ? "array" : typeof revenue?.passes);
      console.log("Pagination data:", data.pagination);
      
      setRevenueData(revenue);
      
      // Extract passes pagination metadata from data.pagination
      if (data.pagination) {
        const totalResults = data.pagination.total_results || 0;
        const apiPage = data.pagination.page || passesPage;
        const limit = 20; // passes_per_page is always 20
        const totalPages = totalResults > 0 ? Math.ceil(totalResults / limit) : 1;
        
        setPassesPagination({
          total: totalResults,
          totalPages: totalPages,
          limit: limit,
        });
        
        console.log("Set pagination:", {
          total: totalResults,
          totalPages: totalPages,
          limit: limit,
          apiPage: apiPage,
          currentPassesPage: passesPage,
        });
      } else if (data.passes_pagination) {
        // Fallback to passes_pagination if it exists
        setPassesPagination(data.passes_pagination);
      } else if (passesPaginationData) {
        // Fallback to extracted passes pagination data
        setPassesPagination(passesPaginationData);
      } else {
        // Reset pagination if not available
        setPassesPagination({});
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch revenue";
      setError(errorMessage);
      console.error("Error fetching revenue:", err);
      setRevenueData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.sub, fromDate, toDate, selectedGymId, passesPage]);
  
  // Reset passes page when filters change
  useEffect(() => {
    setPassesPage(1);
  }, [fromDate, toDate, selectedGymId]);

  // Ensure passesPage doesn't exceed totalPages
  useEffect(() => {
    if (passesPagination.totalPages !== undefined && passesPage > passesPagination.totalPages) {
      setPassesPage(Math.max(1, passesPagination.totalPages));
    }
  }, [passesPagination.totalPages, passesPage]);

  // Fetch locations when user is available
  useEffect(() => {
    if (!authLoading && user?.sub) {
      fetchLocations();
    }
  }, [user?.sub, authLoading, fetchLocations]);

  // Fetch revenue when user or dates or gym filter change
  useEffect(() => {
    if (!authLoading) {
      if (user?.sub) {
        fetchRevenue();
      } else {
        // If no user after auth loading is complete, stop loading
        setLoading(false);
      }
    }
  }, [user?.sub, authLoading, fetchRevenue]);

  const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return "£0.00";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "£0.00";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(numValue);
  };

  const formatNumber = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined) return "0";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "0";
    return new Intl.NumberFormat("en-GB").format(numValue);
  };

  const handleDateChange = (type: "from" | "to", value: string) => {
    if (type === "from") {
      setFromDate(value);
    } else {
      setToDate(value);
    }
  };

  const handleDateRangeChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    
    // Always update state based on what react-datepicker provides
    // This allows react-datepicker to properly reset the range when needed
    setStartDate(start);
    setEndDate(end);
    
    // Update the string dates used for API calls
    if (start) {
      const startStr = start.toISOString().split("T")[0];
      setFromDate(startStr);
    } else {
      setFromDate(getDefaultFromDate());
    }
    
    if (end) {
      const endStr = end.toISOString().split("T")[0];
      setToDate(endStr);
      // Close the picker only when both start and end dates are selected
      if (start) {
        setIsDatePickerOpen(false);
      }
    } else {
      // When end is null and we have a start date, user is selecting a new range
      // Keep the picker open and use default toDate for API calls
      setToDate(getDefaultToDate());
    }
  };

  // Sort revenue entries to put "Total Revenue" first
  const sortedRevenueEntries = useMemo(() => {
    if (!revenueData) return [];
    
    // Filter out objects, arrays, and null values - only include primitives
    // Also explicitly exclude 'passes' array as it's displayed separately
    const entries = Object.entries(revenueData).filter(([key, value]) => {
      // Exclude the passes array - it's displayed separately
      if (key === 'passes' && Array.isArray(value)) {
        return false;
      }
      // Only include primitive values (string, number, boolean) or null
      return value === null || (typeof value !== "object" && !Array.isArray(value));
    });
    
    return entries.sort(([keyA], [keyB]) => {
      const lowerA = keyA.toLowerCase();
      const lowerB = keyB.toLowerCase();
      const isTotalRevenueA = lowerA.includes("total") && lowerA.includes("revenue");
      const isTotalRevenueB = lowerB.includes("total") && lowerB.includes("revenue");
      
      if (isTotalRevenueA && !isTotalRevenueB) return -1;
      if (!isTotalRevenueA && isTotalRevenueB) return 1;
      return 0;
    });
  }, [revenueData]);

  // Separate entries into two groups: Total Revenue/Total Passes and Member types
  const totalRevenueAndPasses = useMemo(() => {
    return sortedRevenueEntries.filter(([key]) => {
      const lowerKey = key.toLowerCase();
      return (lowerKey.includes("total") && lowerKey.includes("revenue")) ||
             (lowerKey.includes("total") && lowerKey.includes("passes"));
    });
  }, [sortedRevenueEntries]);

  const memberTypes = useMemo(() => {
    return sortedRevenueEntries.filter(([key]) => {
      const lowerKey = key.toLowerCase();
      return lowerKey.includes("standard members") ||
             lowerKey.includes("premium members") ||
             lowerKey.includes("elite members");
    });
  }, [sortedRevenueEntries]);

  // Other entries (everything else)
  const otherEntries = useMemo(() => {
    return sortedRevenueEntries.filter(([key]) => {
      const lowerKey = key.toLowerCase();
      const isTotalRevenueOrPasses = (lowerKey.includes("total") && lowerKey.includes("revenue")) ||
                                     (lowerKey.includes("total") && lowerKey.includes("passes"));
      const isMemberType = lowerKey.includes("standard members") ||
                          lowerKey.includes("premium members") ||
                          lowerKey.includes("elite members");
      return !isTotalRevenueOrPasses && !isMemberType;
    });
  }, [sortedRevenueEntries]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar currentPath="/revenue" />
        <div className="lg:pl-72">
          <main className="py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading revenue data...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (authError || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/revenue" />
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Revenue</h2>
              <p className="mt-2 text-sm text-gray-600">
                View revenue summary for the selected date range
              </p>
            </div>

            {/* Filters */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Date Range Filter */}
                <div>
                  <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <div className="relative">
                  <style jsx global>{`
                    .react-datepicker {
                      font-family: inherit;
                      border-radius: 0.75rem;
                      border: none;
                      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                      background-color: #fff;
                      padding: 0.5rem;
                    }
                    .react-datepicker__header {
                      background-color: #fff;
                      border-bottom: none;
                      border-radius: 0.75rem 0.75rem 0 0;
                      padding-top: 0.75rem;
                      padding-bottom: 0.5rem;
                    }
                    .react-datepicker__current-month {
                      font-size: 0.875rem;
                      font-weight: 500;
                      color: #111827;
                      margin-bottom: 0.5rem;
                    }
                    .react-datepicker__navigation {
                      top: 0.75rem;
                    }
                    .react-datepicker__navigation--previous {
                      left: 0.5rem;
                    }
                    .react-datepicker__navigation--previous:hover {
                      border-right-color: #9ca3af;
                    }
                    .react-datepicker__navigation--next {
                      right: 0.5rem;
                    }
                    .react-datepicker__navigation--next:hover {
                      border-left-color: #9ca3af;
                    }
                    .react-datepicker__day-names {
                      margin-bottom: 0.25rem;
                    }
                    .react-datepicker__day-name {
                      color: #4b5563;
                      font-size: 0.75rem;
                      font-weight: 500;
                      width: 2.25rem;
                      line-height: 2.25rem;
                      margin: 0.125rem;
                    }
                    .react-datepicker__day {
                      width: 2.25rem;
                      line-height: 2.25rem;
                      margin: 0.125rem;
                      border-radius: 50%;
                      color: #374151;
                      font-size: 0.875rem;
                    }
                    .react-datepicker__day--outside-month {
                      color: #d1d5db;
                    }
                    .react-datepicker__day--range-start {
                      background-color: #111827 !important;
                      color: #fff !important;
                      font-weight: 500;
                      border-radius: 50% 0 0 50% !important;
                    }
                    .react-datepicker__day--range-end {
                      background-color: #111827 !important;
                      color: #fff !important;
                      font-weight: 500;
                      border-radius: 0 50% 50% 0 !important;
                    }
                    .react-datepicker__day--in-range {
                      background-color: #111827 !important;
                      color: #fff !important;
                      border-radius: 0 !important;
                    }
                    .react-datepicker__day--in-selecting-range:not(.react-datepicker__day--in-range) {
                      background-color: #f3f4f6;
                      color: #374151;
                    }
                    .react-datepicker__day--selected:not(.react-datepicker__day--range-start):not(.react-datepicker__day--range-end):not(.react-datepicker__day--in-range) {
                      background-color: #111827 !important;
                      color: #fff !important;
                      font-weight: 500;
                      border-radius: 50%;
                    }
                    .react-datepicker__day:hover {
                      background-color: #e5e7eb;
                      border-radius: 50%;
                    }
                    .react-datepicker__day--in-range:hover {
                      background-color: #111827 !important;
                      border-radius: 0 !important;
                    }
                    .react-datepicker__day--range-start:hover,
                    .react-datepicker__day--range-end:hover {
                      background-color: #111827 !important;
                    }
                    .react-datepicker__day--disabled {
                      color: #d1d5db;
                      cursor: not-allowed;
                    }
                    .react-datepicker__triangle {
                      display: none;
                    }
                  `}</style>
                  <DatePicker
                    selected={startDate}
                    onChange={handleDateRangeChange}
                    startDate={startDate}
                    endDate={endDate}
                    selectsRange
                    isClearable
                    placeholderText="Select date range"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                    dateFormat="dd/MM/yyyy"
                    calendarClassName="!rounded-xl"
                    wrapperClassName="w-full"
                    monthsShown={1}
                    showPopperArrow={false}
                    shouldCloseOnSelect={false}
                    open={isDatePickerOpen}
                    onInputClick={() => setIsDatePickerOpen(true)}
                    onCalendarClose={() => setIsDatePickerOpen(false)}
                    maxDate={new Date()}
                  />
                </div>
                </div>
                
                {/* Gym Filter */}
                <div>
                  <label htmlFor="gym-filter" className="block text-sm font-medium text-gray-700 mb-2">
                    Gym
                  </label>
                  <select
                    id="gym-filter"
                    value={selectedGymId !== null ? selectedGymId : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setSelectedGymId(null);
                      } else {
                        // Try to parse as number, but keep as string if it's not a valid number
                        const numValue = Number(value);
                        setSelectedGymId(isNaN(numValue) ? value : numValue);
                      }
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                    disabled={loadingGyms}
                  >
                    <option value="">All Gyms</option>
                    {gyms.map((gym) => {
                      const gymId = gym.id ?? gym.gym_id;
                      const gymName = gym.name ?? gym.gym_name ?? "Unknown Gym";
                      return (
                        <option key={gymId} value={gymId}>
                          {gymName}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
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

            {/* Revenue Summary */}
            {revenueData && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Summary</h3>
                
                {/* Helper function to render a card */}
                {(() => {
                  const renderCard = ([key, value]: [string, any]) => {
                    // Format the key for display
                    const displayKey = key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase());

                    // Determine if it's a currency value
                    // Exclude count fields (passes, members) - these should be plain numbers
                    const lowerKey = key.toLowerCase();
                    const isCountField = 
                      lowerKey.includes("passes") ||
                      lowerKey.includes("members") ||
                      lowerKey.includes("count");
                    
                    // Only format as currency if it's clearly a monetary value
                    // and NOT a count field
                    const isCurrency = !isCountField && (
                      lowerKey.includes("revenue") ||
                      lowerKey.includes("amount") ||
                      lowerKey.includes("price") ||
                      lowerKey.includes("cost")
                    );

                    // Handle value display - ensure we extract the actual value
                    // Special handling for total_passes to ensure it's always a number
                    let displayValue: string;
                    if (key === 'total_passes') {
                      // For total_passes, ensure we get the actual number value
                      if (typeof value === "number") {
                        displayValue = formatNumber(value);
                      } else if (Array.isArray(value)) {
                        // If it's an array, show the length (shouldn't happen, but handle it)
                        displayValue = formatNumber(value.length);
                      } else if (value && typeof value === "object" && 'total' in value) {
                        // If it's an object with a total property, use that
                        displayValue = formatNumber((value as any).total);
                      } else if (value && typeof value === "object" && 'count' in value) {
                        // If it's an object with a count property, use that
                        displayValue = formatNumber((value as any).count);
                      } else {
                        // Fallback: try to parse as number or show 0
                        const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
                        displayValue = isNaN(numValue) ? "0" : formatNumber(numValue);
                      }
                    } else if (value === null || value === undefined) {
                      displayValue = "0";
                    } else if (typeof value === "number") {
                      displayValue = isCurrency ? formatCurrency(value) : formatNumber(value);
                    } else if (typeof value === "boolean") {
                      displayValue = value ? "Yes" : "No";
                    } else if (Array.isArray(value)) {
                      // If somehow an array got through, show the length
                      displayValue = formatNumber(value.length);
                    } else if (typeof value === "object") {
                      // If somehow an object got through, try to extract a meaningful value
                      displayValue = "0";
                    } else {
                      displayValue = String(value);
                    }

                    return (
                      <div key={key} className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-500 mb-1">{displayKey}</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {displayValue}
                        </p>
                      </div>
                    );
                  };

                  return (
                    <>
                      {/* Total Revenue and Total Passes - Row of 2 */}
                      {totalRevenueAndPasses.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
                          {totalRevenueAndPasses.map(renderCard)}
                        </div>
                      )}

                      {/* Member Types - Row of 3 */}
                      {memberTypes.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                          {memberTypes.map(renderCard)}
                        </div>
                      )}

                      {/* Other entries - Default grid */}
                      {otherEntries.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {otherEntries.map(renderCard)}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Display nested objects */}
                {Object.entries(revenueData).some(
                  ([, value]) => typeof value === "object" && value !== null && !Array.isArray(value)
                ) && (
                  <div className="mt-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Detailed Breakdown</h4>
                    {Object.entries(revenueData).map(([key, value]) => {
                      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        const displayKey = key
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase());

                        return (
                          <div key={key} className="mb-4 border border-gray-200 rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">{displayKey}</h5>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {Object.entries(value as Record<string, any>).map(([subKey, subValue]) => {
                                const subDisplayKey = subKey
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (l) => l.toUpperCase());

                                // Exclude count fields (passes, members) - these should be plain numbers
                                const lowerSubKey = subKey.toLowerCase();
                                const isCountField = 
                                  lowerSubKey.includes("passes") ||
                                  lowerSubKey.includes("members") ||
                                  lowerSubKey.includes("count");
                                
                                // Only format as currency if it's clearly a monetary value
                                // and NOT a count field
                                const isCurrency = !isCountField && (
                                  lowerSubKey.includes("revenue") ||
                                  lowerSubKey.includes("amount") ||
                                  lowerSubKey.includes("price") ||
                                  lowerSubKey.includes("cost")
                                );

                                return (
                                  <div key={subKey} className="text-sm">
                                    <span className="text-gray-500">{subDisplayKey}: </span>
                                    <span className="font-medium text-gray-900">
                                      {isCurrency
                                        ? formatCurrency(subValue)
                                        : typeof subValue === "number"
                                        ? formatNumber(subValue)
                                        : String(subValue)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}

                {/* Display Passes with Pagination */}
                {revenueData.passes && Array.isArray(revenueData.passes) && revenueData.passes.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Passes</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(revenueData.passes[0]).map((key) => (
                              <th
                                key={key}
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {revenueData.passes.map((pass: any, index: number) => {
                            // Use a unique identifier if available, otherwise use index
                            const rowKey = pass.id || pass.pass_id || pass._id || index;
                            return (
                            <tr key={rowKey} className="hover:bg-gray-50">
                              {Object.keys(revenueData.passes[0]).map((key) => {
                                const value = pass[key];
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
                                      {JSON.stringify(value)}
                                    </span>
                                  );
                                } else if (typeof value === "number") {
                                  // Check if it's a currency field
                                  const lowerKey = key.toLowerCase();
                                  const isCurrency = 
                                    lowerKey.includes("revenue") ||
                                    lowerKey.includes("amount") ||
                                    lowerKey.includes("price") ||
                                    lowerKey.includes("cost");
                                  displayValue = isCurrency ? formatCurrency(value) : formatNumber(value);
                                } else {
                                  displayValue = String(value);
                                }

                                return (
                                  <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {displayValue}
                                  </td>
                                );
                              })}
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls for Passes */}
                    {(passesPagination.totalPages !== undefined || revenueData.passes.length > 0) && (
                      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow">
                        <div className="flex-1 flex justify-between sm:hidden">
                          <button
                            onClick={() => setPassesPage((prev) => Math.max(1, prev - 1))}
                            disabled={passesPage === 1 || loading}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() =>
                              setPassesPage((prev) =>
                                passesPagination.totalPages
                                  ? Math.min(passesPagination.totalPages, prev + 1)
                                  : prev + 1
                              )
                            }
                            disabled={
                              (passesPagination.totalPages !== undefined &&
                                passesPage >= passesPagination.totalPages) ||
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
                                {revenueData.passes.length > 0
                                  ? (passesPage - 1) * (passesPagination.limit || 20) + 1
                                  : 0}
                              </span>{" "}
                              to{" "}
                              <span className="font-medium">
                                {(passesPage - 1) * (passesPagination.limit || 20) + revenueData.passes.length}
                              </span>{" "}
                              of{" "}
                              <span className="font-medium">
                                {passesPagination.total || "many"}
                              </span>{" "}
                              results
                            </p>
                          </div>
                          <div>
                            <nav
                              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                              aria-label="Pagination"
                            >
                              <button
                                onClick={() =>
                                  setPassesPage((prev) => Math.max(1, prev - 1))
                                }
                                disabled={passesPage === 1 || loading}
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
                              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                Page {passesPage} {passesPagination.totalPages && `of ${passesPagination.totalPages}`}
                              </span>
                              <button
                                onClick={() =>
                                  setPassesPage((prev) =>
                                    passesPagination.totalPages
                                      ? Math.min(passesPagination.totalPages, prev + 1)
                                      : prev + 1
                                  )
                                }
                                disabled={
                                  (passesPagination.totalPages !== undefined &&
                                    passesPage >= passesPagination.totalPages) ||
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
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && !revenueData && (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No revenue data</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No revenue data found for the selected date range.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

