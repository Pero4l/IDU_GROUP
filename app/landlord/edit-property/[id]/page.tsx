"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/Dashboard/DashboardLayout";
import { useForm } from "react-hook-form";
import {
  Upload,
  Info,
  DollarSign,
  Sparkles,
  Image as ImageIcon,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useGetRentalById, useUpdateRental } from "@/app/api/features/rental";
import type { UpdateRentalPayload } from "@/app/api/features/rental";

interface FormData {
  title: string;
  description: string;
  location: string;
  propertyType: string;
  basicRent: number;
  legalFee: number;
  cautionFee: number;
  brokeFee: number;
  mgtServiceCharge: number;
  status: string;
  amenities: string[];
}

const defaultValues: FormData = {
  title: "",
  description: "",
  location: "",
  propertyType: "apartment",
  basicRent: 0,
  legalFee: 0,
  cautionFee: 0,
  brokeFee: 0,
  mgtServiceCharge: 0,
  status: "",
  amenities: [],
};

const toMoneyNumber = (value: unknown): number => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
};

const Page = () => {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [removedVideos, setRemovedVideos] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: rentalData, isLoading, isError, error } = useGetRentalById(id);
  const { mutate: updateRental, isPending } = useUpdateRental(id ?? "");

  const {
    register,
    watch,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ defaultValues });

  useEffect(() => {
    if (!rentalData) {
      return;
    }

    const legalFee = toMoneyNumber(rentalData.legalFee);
    const cautionFee = toMoneyNumber(rentalData.cautionFee);
    const brokeFee = toMoneyNumber(rentalData.brokeFee);
    const mgtServiceCharge = toMoneyNumber(rentalData.mgtServiceCharge);
    const totalFees = legalFee + cautionFee + brokeFee + mgtServiceCharge;
    const basicRent = Math.max(toMoneyNumber(rentalData.price) - totalFees, 0);

    reset({
      title: rentalData.title,
      description: rentalData.description,
      location: rentalData.location,
      propertyType: rentalData.propertyType || "apartment",
      basicRent,
      legalFee,
      cautionFee,
      brokeFee,
      mgtServiceCharge,
      status: rentalData.status,
      amenities: rentalData.amenities || [],
    });
  }, [rentalData, reset]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
      videoPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [imagePreviews, videoPreviews]);

  const fees = watch([
    "basicRent",
    "legalFee",
    "cautionFee",
    "brokeFee",
    "mgtServiceCharge",
  ]);
  const totalPackages = useMemo(
    () => fees.reduce((acc, curr) => acc + toMoneyNumber(curr), 0),
    [fees],
  );
  const existingImages = rentalData?.images.filter(
    (image) => !removedImages.includes(image),
  ) ?? [];
  const existingVideos = rentalData?.videos.filter(
    (video) => !removedVideos.includes(video),
  ) ?? [];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setImages((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [
      ...prev,
      ...newFiles.map((file) => URL.createObjectURL(file)),
    ]);
    e.target.value = "";
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setVideos((prev) => [...prev, ...newFiles]);
    setVideoPreviews((prev) => [
      ...prev,
      ...newFiles.map((file) => URL.createObjectURL(file)),
    ]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    URL.revokeObjectURL(videoPreviews[index]);
    setVideos((prev) => prev.filter((_, i) => i !== index));
    setVideoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (image: string) => {
    setRemovedImages((previousImages) =>
      previousImages.includes(image) ? previousImages : [...previousImages, image],
    );
  };

  const removeExistingVideo = (video: string) => {
    setRemovedVideos((previousVideos) =>
      previousVideos.includes(video) ? previousVideos : [...previousVideos, video],
    );
  };

  const onSubmit = (data: FormData) => {
    if (!id) return;

    setSubmitError(null);

    const payload: UpdateRentalPayload = {
      title: data.title,
      description: data.description,
      propertyType: data.propertyType,
      location: data.location,
      price: totalPackages,
      priceType: rentalData?.priceType || "yearly",
      status: data.status,
      amenities: data.amenities,
      legalFee: toMoneyNumber(data.legalFee),
      cautionFee: toMoneyNumber(data.cautionFee),
      brokeFee: toMoneyNumber(data.brokeFee),
      mgtServiceCharge: toMoneyNumber(data.mgtServiceCharge),
    };

    if (removedImages.length > 0) {
      payload.removedImages = removedImages;
    }

    if (removedVideos.length > 0) {
      payload.removedVideos = removedVideos;
    }

    if (images.length > 0) {
      payload.images = images;
    }

    if (videos.length > 0) {
      payload.videos = videos;
    }

    updateRental(payload, {
      onSuccess: () => {
        router.push("/landlord/my-listings");
      },
      onError: (updateError) => {
        setSubmitError(
          updateError instanceof Error
            ? updateError.message
            : "Failed to update listing. Please try again.",
        );
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#F8FAFC] p-8 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#43A047]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!id || isError || !rentalData) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#F8FAFC] p-8">
          <div className="max-w-[900px] mx-auto bg-white border border-red-100 rounded-2xl p-6">
            <h1 className="text-xl font-bold text-slate-800">
              Property not found
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              {error instanceof Error
                ? error.message
                : "We could not load this property listing."}
            </p>
            <button
              type="button"
              onClick={() => router.push("/landlord/my-listings")}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#43A047] px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
            >
              <ArrowLeft size={16} />
              Back to listings
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen">
        <div className="max-w-[1400px] mx-auto">
          <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Edit Property
              </h1>
              <p className="text-slate-500 text-sm">
                Update the details below to modify your property listing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/landlord/my-listings")}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </header>

          {submitError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
              {submitError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-8">
              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6 text-[#4CAF50]">
                  <div className="bg-[#4CAF50]/10 p-2 rounded-full">
                    <Info size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">
                    General Information
                  </h3>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Property Title *
                    </label>
                    <input
                      {...register("title", { required: "Title is required" })}
                      placeholder="e.g. Luxury 3-Bedroom apartment with Ocean View"
                      className="w-full p-4 bg-[#F8FAFC] rounded-2xl border-none focus:ring-2 focus:ring-[#4CAF50]"
                    />
                    {errors.title && (
                      <p className="text-red-500 text-xs ml-1">
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Description *
                    </label>
                    <textarea
                      {...register("description", {
                        required: "Description is required",
                      })}
                      rows={5}
                      placeholder="Describe the key features, neighborhood, and unique selling points..."
                      className="w-full p-4 bg-[#F8FAFC] rounded-2xl border-none focus:ring-2 focus:ring-[#4CAF50]"
                    />
                    {errors.description && (
                      <p className="text-red-500 text-xs ml-1">
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Location / City *
                      </label>
                      <select
                        {...register("location", {
                          required: "Location is required",
                        })}
                        className="w-full p-4 bg-[#F8FAFC] rounded-2xl border-none outline-none"
                      >
                        <option value="">Select a location</option>
                        <option value="lagos">Lagos</option>
                        <option value="abuja">Abuja</option>
                        <option value="port-harcourt">Imo</option>
                        <option value="port-harcourt">Enugu</option>
                      </select>
                      {errors.location && (
                        <p className="text-red-500 text-xs ml-1">
                          {errors.location.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Property Type
                      </label>
                      <select
                        {...register("propertyType")}
                        className="w-full p-4 bg-[#F8FAFC] rounded-2xl border-none outline-none"
                      >
                        <option value="apartment">Apartment</option>
                        <option value="house">House</option>
                        <option value="office">Office</option>
                        <option value="commercial">Commercial</option>
                        <option value="land">Land</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      House Status
                    </label>
                    <select
                      {...register("status")}
                      className="w-full p-4 bg-[#F8FAFC] rounded-2xl border-none outline-none"
                    >
                      <option value="available">Available</option>
                      <option value="pending">Pending</option>
                      <option value="locked">Locked</option>
                      <option value="rented">Rented</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6 text-[#4CAF50]">
                  <div className="bg-[#4CAF50]/10 p-2 rounded-full">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">
                    Amenities & Features
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    "24/7 Power",
                    "Swimming Pool",
                    "Security",
                    "Gym",
                    "Parking",
                    "WiFi",
                    "Elevator",
                    "Garden",
                  ].map((item) => (
                    <label
                      key={item}
                      className="flex flex-col items-center justify-center p-4 bg-[#F8FAFC] rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        value={item}
                        {...register("amenities")}
                        className="mb-2 accent-[#4CAF50]"
                      />
                      <span className="text-[10px] font-bold text-slate-500 text-center uppercase">
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6 text-[#4CAF50]">
                  <div className="bg-[#4CAF50]/10 p-2 rounded-full">
                    <DollarSign size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">
                    Financial Breakdown
                  </h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-[#4CAF50] uppercase ml-1">
                      Basic Rent (Annual) *
                    </label>
                    <input
                      type="number"
                      {...register("basicRent", {
                        valueAsNumber: true,
                        required: "Rent is required",
                        min: { value: 1, message: "Must be greater than 0" },
                      })}
                      className="w-full p-3 bg-[#F8FAFC] rounded-xl border-none outline-none"
                    />
                    {errors.basicRent && (
                      <p className="text-red-500 text-xs ml-1">
                        {errors.basicRent.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Mgt Service Charge
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register("mgtServiceCharge", {
                          valueAsNumber: true,
                        })}
                        className="w-full p-3 bg-[#F8FAFC] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Legal Fees
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register("legalFee", { valueAsNumber: true })}
                        className="w-full p-3 bg-[#F8FAFC] rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Caution Fee
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...register("cautionFee", { valueAsNumber: true })}
                      className="w-full p-3 bg-[#F8FAFC] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Broker Fee
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...register("brokeFee", { valueAsNumber: true })}
                      className="w-full p-3 bg-[#F8FAFC] rounded-xl"
                    />
                  </div>

                  <div className="mt-6 p-4 bg-[#4CAF50]/5 rounded-2xl border border-[#4CAF50]/10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Total Package
                    </p>
                    <p className="text-2xl font-bold text-[#4CAF50]">
                      N{totalPackages.toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6 text-pink-500">
                  <div className="bg-pink-50 p-2 rounded-full">
                    <ImageIcon size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">Property Images</h3>
                </div>

                {existingImages.length > 0 && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {existingImages.map((image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="relative aspect-square rounded-xl overflow-hidden bg-slate-100"
                      >
                        <img
                          src={image}
                          alt={`${rentalData.title} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(image)}
                          title="Remove image"
                          aria-label={`Remove image ${index + 1}`}
                          className="absolute top-1 right-1 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all">
                    <Upload size={24} className="text-slate-400 mb-2" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Upload new images
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {images.length} new image(s) selected
                    </p>
                  </div>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div
                        key={preview}
                        className="relative aspect-square rounded-xl overflow-hidden"
                      >
                        <img
                          src={preview}
                          alt={`New preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-6 text-pink-500">
                  <div className="bg-pink-50 p-2 rounded-full">
                    <ImageIcon size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">Property Videos</h3>
                </div>

                {existingVideos.length > 0 && (
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {existingVideos.map((video, index) => (
                      <div
                        key={`${video}-${index}`}
                        className="relative aspect-video rounded-xl overflow-hidden bg-slate-100"
                      >
                        <video
                          src={video}
                          controls
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingVideo(video)}
                          title="Remove video"
                          aria-label={`Remove video ${index + 1}`}
                          className="absolute top-1 right-1 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={handleVideoChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all">
                    <Upload size={24} className="text-slate-400 mb-2" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Upload new videos
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {videos.length} new video(s) selected
                    </p>
                  </div>
                </div>

                {videoPreviews.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {videoPreviews.map((preview, index) => (
                      <div
                        key={preview}
                        className="relative aspect-video rounded-xl overflow-hidden"
                      >
                        <video
                          src={preview}
                          controls
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeVideo(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-5 bg-[#00C853] text-white font-bold text-lg rounded-2xl shadow-lg shadow-green-100 hover:bg-[#00B44A] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Page;
