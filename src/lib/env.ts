export const getAisStreamApiKey = (): string => {
  return process.env.AISSTREAM_API_KEY ?? "";
};

export const isVesselTrackingEnabled = (): boolean => {
  return getAisStreamApiKey().length > 0;
};
