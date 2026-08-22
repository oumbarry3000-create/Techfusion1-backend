// Upload direct depuis le navigateur vers Cloudinary (unsigned upload preset)
// Config nécessaire côté Cloudinary Console :
// 1. Créer un "Upload preset" en mode "Unsigned"
// 2. Renseigner CLOUD_NAME et UPLOAD_PRESET ci-dessous (ou via variables d'env)

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload un fichier (logo de service, preuve de paiement, photo de profil) vers Cloudinary.
 * @param {File} file
 * @param {string} folder - dossier logique dans Cloudinary (ex: "services", "preuves-paiement")
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadToCloudinary(file, folder = "techno") {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary non configuré : renseigne VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET dans .env"
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Échec upload Cloudinary : " + err);
  }

  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

/**
 * Construit une URL Cloudinary transformée (redimensionnement, recadrage) à la volée.
 */
export function cloudinaryThumb(url, { width = 200, height = 200 } = {}) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace(
    "/upload/",
    `/upload/w_${width},h_${height},c_fill,q_auto,f_auto/`
  );
}
