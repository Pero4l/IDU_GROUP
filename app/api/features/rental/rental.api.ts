import api from "../../axios";
import { API_BASE_URL } from "../../axios";
import type { AxiosError } from "axios";
import { getCurrentUserId } from "@/app/lib/auth";
import type {
  ApiResponse,
  CreateRentalPayload,
  LandlordListedProperties,
  RawRental,
  Rental,
  RentalRequestOptions,
  RentalSearchParams,
  UpdateRentalPayload,
} from "./types";

export type {
  ApiResponse,
  CreateRentalPayload,
  LandlordListedProperties,
  LandlordProfile,
  ProfileCompletionError,
  RawRental,
  Rental,
  RentalListResponse,
  RentalRequestOptions,
  RentalSearchParams,
  RentalStatus,
  RentalUser,
  UpdateRentalPayload,
} from "./types";

type ProfileRentalsResponse = {
  success?: boolean;
  data?: {
    user?: Partial<LandlordListedProperties>;
    profile?: LandlordListedProperties["profile"];
    rentals?: RawRental[];
  };
  message?: string;
};

const getApiBaseUrl = () =>
  String(api.defaults.baseURL ?? "").replace(/\/$/, "");

const parseJsonSafely = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeMoneyValue = (value: unknown): number => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
};

const rentalResponseKeys = [
  "data",
  "rental",
  "property",
  "listing",
  "item",
  "result",
] as const;

const looksLikeRental = (value: unknown): value is RawRental => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    "id" in candidate ||
    "_id" in candidate ||
    "title" in candidate ||
    "propertyType" in candidate ||
    "location" in candidate ||
    "price" in candidate ||
    "images" in candidate ||
    "videos" in candidate
  );
};

const extractRentalRecord = (payload: unknown): RawRental | null => {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const rental = extractRentalRecord(item);
      if (rental) {
        return rental;
      }
    }

    return null;
  }

  if (looksLikeRental(payload)) {
    return payload;
  }

  if (typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  for (const key of rentalResponseKeys) {
    const rental = extractRentalRecord(record[key]);

    if (rental) {
      return rental;
    }
  }

  return null;
};

const buildFallbackRental = (
  payload: CreateRentalPayload | UpdateRentalPayload,
): RawRental => ({
  id: "",
  title: payload.title ?? "",
  description: payload.description ?? "",
  propertyType: payload.propertyType ?? "",
  location: payload.location ?? "",
  price: payload.price ?? "",
  legalFee: payload.legalFee ?? 0,
  cautionFee: payload.cautionFee ?? 0,
  brokeFee: payload.brokeFee ?? 0,
  mgtServiceCharge: payload.mgtServiceCharge ?? 0,
  priceType: payload.priceType ?? "yearly",
  status: payload.status ?? "available",
  images: [],
  videos: [],
  amenities: payload.amenities ?? [],
  UserId: getCurrentUserId() ?? "",
  createdAt: new Date().toISOString(),
});

const normalizeMediaUrl = (value: string): string => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.startsWith("data:")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("//")) {
    return `https:${trimmedValue}`;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`;
  }

  return trimmedValue.startsWith("/")
    ? `${baseUrl}${trimmedValue}`
    : `${baseUrl}/${trimmedValue}`;
};

const normalizeMediaList = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeMediaList(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return [];
    }

    if (trimmedValue.startsWith("[") || trimmedValue.startsWith("{")) {
      return normalizeMediaList(parseJsonSafely(trimmedValue));
    }

    return [normalizeMediaUrl(trimmedValue)].filter(Boolean);
  }

  if (typeof value === "object") {
    const mediaObject = value as Record<string, unknown>;

    return ["secure_url", "url", "image", "path", "src"]
      .flatMap((key) => normalizeMediaList(mediaObject[key]))
      .filter((item): item is string => Boolean(item));
  }

  return [];
};

const normalizeStringList = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeStringList(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return [];
    }

    if (trimmedValue.startsWith("[") || trimmedValue.startsWith("{")) {
      return normalizeStringList(parseJsonSafely(trimmedValue));
    }

    return [trimmedValue];
  }

  return [];
};

export const normalizeRental = (rental: RawRental): Rental => ({
  id: String(rental.id ?? rental._id ?? ""),
  title: rental.title ?? "",
  description: rental.description ?? "",
  propertyType: rental.propertyType ?? "",
  location: rental.location ?? "",
  price: rental.price ?? "",
  legalFee: normalizeMoneyValue(rental.legalFee),
  cautionFee: normalizeMoneyValue(rental.cautionFee),
  brokeFee: normalizeMoneyValue(rental.brokeFee),
  mgtServiceCharge: normalizeMoneyValue(rental.mgtServiceCharge),
  priceType: rental.priceType ?? "yearly",
  status: rental.status ?? "available",
  lockedAt:
    typeof rental.lockedAt === "string"
      ? rental.lockedAt
      : typeof rental.locked_at === "string"
        ? rental.locked_at
        : undefined,
  images: normalizeMediaList(rental.images),
  videos: normalizeMediaList(rental.videos),
  amenities: normalizeStringList(rental.amenities),
  UserId: rental.UserId ?? rental.userId ?? "",
  createdAt: rental.createdAt ?? "",
  slug: rental.slug,
  User: rental.User ?? null,
});

export const normalizeRentalListResponse = (
  data: RawRental[] | { rentals?: RawRental[] } | null | undefined,
): Rental[] => {
  if (Array.isArray(data)) {
    return data.map(normalizeRental);
  }

  if (data && Array.isArray(data.rentals)) {
    return data.rentals.map(normalizeRental);
  }

  return [];
};

export const fetchLandlordListedProperties =
  async (): Promise<LandlordListedProperties> => {
    const userId = getCurrentUserId();

    if (!userId) {
      throw new Error("You must be logged in to view landlord listings.");
    }

    const response = await api.get<ProfileRentalsResponse>(
      `/profile/get1/${userId}`,
    );
    const profileData = response.data.data;
    const user = profileData?.user;
    const rentals = normalizeRentalListResponse(profileData?.rentals);

    return {
      id: String(user?.id ?? userId),
      full_name: String(user?.full_name ?? ""),
      gender: typeof user?.gender === "string" ? user.gender : "",
      phone_no: String(user?.phone_no ?? ""),
      address: typeof user?.address === "string" ? user.address : "",
      state: String(user?.state ?? ""),
      country: String(user?.country ?? ""),
      role: "landlord",
      is_active: typeof user?.is_active === "boolean" ? user.is_active : true,
      is_superadmin:
        typeof user?.is_superadmin === "boolean" ? user.is_superadmin : false,
      profile: profileData?.profile ?? null,
      rentals,
      totalListings: rentals.length,
      createdAt: String(user?.createdAt ?? ""),
      updatedAt: String(user?.updatedAt ?? ""),
    };
  };

const appendFormDataValue = (
  formData: FormData,
  key: string,
  value: unknown,
) => {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    const normalizedItems = value
      .flatMap((item) => {
        if (item === undefined || item === null) {
          return [];
        }

        if (typeof item === "string") {
          const trimmedItem = item.trim();
          return trimmedItem ? [trimmedItem] : [];
        }

        return [String(item)];
      })
      .filter(Boolean);

    if (
      key === "amenities" ||
      key === "removedImages" ||
      key === "removedVideos"
    ) {
      if (normalizedItems.length > 0) {
        formData.append(key, JSON.stringify(normalizedItems));

        if (key === "amenities") {
          normalizedItems.forEach((item) => {
            formData.append("amenities[]", item);
          });
        }
      }
      return;
    }

    normalizedItems.forEach((item) => {
      formData.append(key, String(item));
    });
    return;
  }

  formData.append(key, String(value));
};

const buildRentalFormData = (
  payload: CreateRentalPayload | UpdateRentalPayload,
): FormData => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (key !== "images" && key !== "videos") {
      appendFormDataValue(formData, key, value);
    }
  });

  if (payload.images && payload.images.length > 0) {
    payload.images.forEach((image) => {
      formData.append("images", image);
    });
  }

  if (payload.videos && payload.videos.length > 0) {
    payload.videos.forEach((video) => {
      formData.append("videos", video);
    });
  }

  return formData;
};

export const rentalApi = {
  fetchLandlordListedProperties,

  createRental: async (payload: CreateRentalPayload): Promise<Rental> => {
    const formData = buildRentalFormData(payload);
    const response = await api.post<ApiResponse<RawRental>>(
      "/rental/post",
      formData,
      { withCredentials: true },
    );

    const rental =
      extractRentalRecord(response.data) ?? buildFallbackRental(payload);
    return normalizeRental(rental);
  },

  getAllRentals: async (options?: RentalRequestOptions): Promise<Rental[]> => {
    // For public access, make request without authorization header
    if (options?.skipAuthRedirect) {
      const response = await fetch(`${API_BASE_URL}/rental/recent`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rentals: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse<
        RawRental[] | { rentals?: RawRental[] }
      >;
      return normalizeRentalListResponse(data.data);
    }

    // For authenticated requests, use the api instance first.
    // If the authenticated endpoint is unavailable, fall back to the public recent rentals route.
    try {
      const response =
        await api.get<ApiResponse<RawRental[] | { rentals?: RawRental[] }>>(
          "/rental/all",
        );
      return normalizeRentalListResponse(response.data.data);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (status === 404 || status === 401) {
        const fallbackResponse = await fetch(`${API_BASE_URL}/rental/recent`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!fallbackResponse.ok) {
          throw error;
        }

        const data = (await fallbackResponse.json()) as ApiResponse<
          RawRental[] | { rentals?: RawRental[] }
        >;
        return normalizeRentalListResponse(data.data);
      }

      throw error;
    }
  },

  searchRentals: async (
    params: RentalSearchParams,
    options?: RentalRequestOptions,
  ): Promise<Rental[]> => {
    const queryParams = new URLSearchParams();

    if (params.location) {
      queryParams.append("location", params.location);
    }

    if (params.lat !== undefined && params.lng !== undefined) {
      queryParams.append("lat", String(params.lat));
      queryParams.append("lng", String(params.lng));
    }

    const queryString = queryParams.toString();
    const url = queryString
      ? `/rental/search?${queryString}`
      : "/rental/search";

    // For public access, make request without authorization header
    if (options?.skipAuthRedirect) {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to search rentals: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse<
        RawRental[] | { rentals?: RawRental[] }
      >;
      return normalizeRentalListResponse(data.data);
    }

    // For authenticated requests, use the api instance
    const response =
      await api.get<ApiResponse<RawRental[] | { rentals?: RawRental[] }>>(url);
    return normalizeRentalListResponse(response.data.data);
  },

  getRentalById: async (
    id: string,
    options?: RentalRequestOptions,
  ): Promise<Rental> => {
    const response = await api.get<ApiResponse<RawRental>>(
      `/rental/get1/${id}`,
      options?.skipAuthRedirect
        ? ({ skipAuthRedirect: true } as any)
        : undefined,
    );

    const rental = extractRentalRecord(response.data);

    if (!rental) {
      throw new Error("Unable to load rental details.");
    }

    return normalizeRental(rental);
  },

  updateRental: async (
    id: string,
    payload: UpdateRentalPayload,
  ): Promise<Rental> => {
    const requestBody =
      (payload.images && payload.images.length > 0) ||
      (payload.videos && payload.videos.length > 0)
        ? buildRentalFormData(payload)
        : payload;

    const response = await api.put<ApiResponse<RawRental>>(
      `/rental/update/${id}`,
      requestBody,
    );

    const rental =
      extractRentalRecord(response.data) ??
      buildFallbackRental({
        ...payload,
        title: payload.title ?? "",
        description: payload.description ?? "",
        propertyType: payload.propertyType ?? "",
        location: payload.location ?? "",
        price: payload.price ?? "",
        priceType: payload.priceType ?? "yearly",
        status: payload.status ?? "available",
      });

    return normalizeRental(rental);
  },

  deleteRental: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/rental/delete/${id}`);
  },
};
