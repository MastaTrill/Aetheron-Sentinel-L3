const isProd = process.env.NODE_ENV === "production";

export default {
  output: "export",
  images: { unoptimized: true },
  basePath: isProd ? "/Aetheron-Sentinel-L3/dashboard" : ""
};
