"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "../../../../components/Sidebar";

interface MemberDetails {
  email: string;
  full_name: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_postcode: string;
  date_of_birth: string;
  created_at: string;
  updated_at: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  [key: string]: any;
}

export default function MemberDetail() {
  const { user, error: authError, isLoading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const memberAuth0Id = params?.id ? decodeURIComponent(params.id as string) : undefined;

  const [member, setMember] = useState<MemberDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.sub && memberAuth0Id) {
      fetchMemberDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sub, memberAuth0Id]);

  const fetchMemberDetails = async () => {
    if (!memberAuth0Id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("https://api.any-gym.com/admin/members/view", {
        headers: {
          "auth0_id": user?.sub || "",
          "member_auth0_id": memberAuth0Id,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Member not found");
        }
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch member details: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setMember(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch member details";
      setError(errorMessage);
      console.error("Error fetching member details:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading member details...</p>
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
        <Sidebar currentPath="/dashboard/members" />
        <div className="lg:pl-72">
          <main className="py-8">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <button
                  onClick={() => router.back()}
                  className="text-sm text-blue-600 hover:text-blue-800 mb-4"
                >
                  ← Back to Members
                </button>
                <h2 className="text-3xl font-bold text-gray-900">Member Details</h2>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath="/dashboard/members" />

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <button
                onClick={() => router.back()}
                className="text-sm text-blue-600 hover:text-blue-800 mb-4"
              >
                ← Back to Members
              </button>
              <h2 className="text-3xl font-bold text-gray-900">Member Details</h2>
              <p className="mt-2 text-sm text-gray-600">
                View member information
              </p>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
              </div>
              <dl className="divide-y divide-gray-200">
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.full_name || "-"}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.email || "-"}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDate(member.date_of_birth)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Address</h3>
              </div>
              <dl className="divide-y divide-gray-200">
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Address Line 1</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.address_line1 || "-"}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Address Line 2</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.address_line2 || "-"}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">City</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.address_city || "-"}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Postcode</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.address_postcode || "-"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Emergency Contact</h3>
              </div>
              <dl className="divide-y divide-gray-200">
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Contact Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.emergency_contact_name || "-"}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Contact Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {member.emergency_contact_number || "-"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
              </div>
              <dl className="divide-y divide-gray-200">
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDate(member.created_at)}
                  </dd>
                </div>
                <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">Updated At</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDate(member.updated_at)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

