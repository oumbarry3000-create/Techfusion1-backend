// OPTIONNEL — recommandé pour la prod.
// Ce n'est PAS une Cloud Function Firebase : c'est un fichier serverless
// autonome que tu peux déployer gratuitement sur Vercel (aucun "cloud function" Firebase requis).
//
// Installation :
// 1. Crée un compte Vercel (gratuit), installe la CLI: npm i -g vercel
// 2. Place ce fichier dans un dossier /api à la racine d'un petit projet Vercel
//    (ou déploie ce dossier /server tel quel avec `vercel`)
// 3. Ajoute la variable d'environnement ANTHROPIC_API_KEY dans le dashboard Vercel
// 4. Remplace l'URL dans src/lib/claudeChat.js par l'URL Vercel obtenue (ex: https://ton-projet.vercel.app/api/chat)
// 5. Dans claudeChat.js, retire le header x-api-key et appelle plutôt cette route

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { question, systemPrompt } = req.body;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    }),
  });

  const data = await response.json();
  res.status(200).json(data);
}
