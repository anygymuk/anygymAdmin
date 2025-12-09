"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";

interface Event {
  id: string;
  [key: string]: any; // Allow for flexible event structure
}

export default function Events() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [gymName, setGymName] = useState("");
  const [eventType, setEventType] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  // Extract unique values for dropdowns
  const getUniqueGymNames = (): string[] => {
    const gymNameField = ['gym_name', 'gymName'].find(field => 
      events.length > 0 && events[0].hasOwnProperty(field)
    );
    if (!gymNameField) return [];
    
    const uniqueNames = new Set<string>();
    events.forEach(event => {
      const value = event[gymNameField];
      if (value !== null && value !== undefined && value !== '') {
        uniqueNames.add(String(value));
      }
    });
    return Array.from(uniqueNames).sort();
  };

  const getUniqueEventTypes = (): string[] => {
    const eventTypeField = ['event_type', 'eventType', 'type'].find(field => 
      events.length > 0 && events[0].hasOwnProperty(field)
    );
    if (!eventTypeField) return [];
    
    const uniqueTypes = new Set<string>();
    events.forEach(event => {
      const value = event[eventTypeField];
      if (value !== null && value !== undefined && value !== '') {
        uniqueTypes.add(String(value));
      }
    });
    return Array.from(uniqueTypes).sort();
  };

  const fetchEvents = useCallback(async () => {
    if (!user?.sub) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      
      if (startDate) {
        params.append("start_date", startDate);
      }
      if (endDate) {
        params.append("end_date", endDate);
      }
      if (gymName && gymName.trim()) {
        params.append("gym_name", gymName.trim());
      }
      if (eventType && eventType.trim()) {
        params.append("event_type", eventType.trim());
      }

      const url = `https://api.any-gym.com/admin/events${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("Fetching events from:", url);

      const response = await fetch(url, {
        headers: {
          "auth0_id": user.sub,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);

      // Handle different response formats
      if (Array.isArray(data)) {
        setEvents(data);
      } else if (data.results && Array.isArray(data.results)) {
        setEvents(data.results);
      } else if (data.data && Array.isArray(data.data)) {
        setEvents(data.data);
      } else {
        console.warn("Unexpected response format:", data);
        setEvents([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch events";
      setError(errorMessage);
      console.error("Error fetching events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user?.sub, startDate, endDate, gymName, eventType]);

  // Fetch events when user or filters change
  useEffect(() => {
    if (user?.sub) {
      fetchEvents();
    }
  }, [user?.sub, startDate, endDate, gymName, eventType, fetchEvents]);

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

  // Define the specific columns to display in order
  const getTableColumns = () => {
    // Map of display names to possible API field names
    const columnMapping: Record<string, string[]> = {
      'ID': ['id'],
      'Created At': ['created_at', 'createdAt', 'created'],
      'Gym Name': ['gym_name', 'gymName', 'gym_name'],
      'Event Type': ['event_type', 'eventType', 'type'],
      'Event Description': ['event_description', 'eventDescription', 'description'],
      'Admin User': ['admin_user', 'adminUser', 'admin_user_id'],
    };

    if (events.length === 0) return [];

    const firstEvent = events[0];
    const availableFields = Object.keys(firstEvent);
    
    // Find the actual field name for each column
    const columns: string[] = [];
    Object.keys(columnMapping).forEach((displayName) => {
      const possibleNames = columnMapping[displayName];
      const foundField = possibleNames.find(name => availableFields.includes(name));
      if (foundField) {
        columns.push(foundField);
      }
    });

    return columns;
  };

  const columns = getTableColumns();
  
  // Map column field names to display names
  const getColumnDisplayName = (fieldName: string): string => {
    const displayMap: Record<string, string> = {
      'id': 'ID',
      'created_at': 'Created At',
      'createdAt': 'Created At',
      'created': 'Created At',
      'gym_name': 'Gym Name',
      'gymName': 'Gym Name',
      'event_type': 'Event Type',
      'eventType': 'Event Type',
      'type': 'Event Type',
      'event_description': 'Event Description',
      'eventDescription': 'Event Description',
      'description': 'Event Description',
      'admin_user': 'Admin User',
      'adminUser': 'Admin User',
      'admin_user_id': 'Admin User',
    };
    return displayMap[fieldName] || fieldName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/events" />

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Events</h2>
              <p className="mt-2 text-sm text-gray-600">
                View and manage all events
              </p>
            </div>

            {/* Filters */}
            <div className="mb-6 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Created At - Start Date */}
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                    Created At (From)
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                {/* Created At - End Date */}
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                    Created At (To)
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                {/* Gym Name */}
                <div>
                  <label htmlFor="gym-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Gym Name
                  </label>
                  <select
                    id="gym-name"
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">All Gyms</option>
                    {getUniqueGymNames().map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Event Type */}
                <div>
                  <label htmlFor="event-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Event Type
                  </label>
                  <select
                    id="event-type"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">All Event Types</option>
                    {getUniqueEventTypes().map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(startDate || endDate || gymName || eventType) && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setGymName("");
                      setEventType("");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
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
            {loading && events.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-600">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No events available
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  There are no events to display at this time.
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
                            {getColumnDisplayName(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {events.map((event) => (
                        <tr key={event.id || JSON.stringify(event)} className="hover:bg-gray-50">
                          {columns.map((column) => {
                            const value = event[column];
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
                              // Format date strings to show full date and time
                              try {
                                const date = new Date(value);
                                // Format as full date and time (DD/MM/YYYY, HH:MM:SS)
                                displayValue = date.toLocaleString('en-GB', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                });
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
          </div>
        </main>
      </div>
    </div>
  );
}

