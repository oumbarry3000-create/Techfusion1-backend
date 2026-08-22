import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { checkPaymentStatus } from '../api/payment';

export default function PaymentConfirmation() {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId');
  const [status, setStatus] = useState('en_attente');
  const [subscriberId, setSubscriberId] = useState(null);

  useEffect(() => {
    if (!transactionId) return;

    let interval = setInterval(async () => {
      try {
        const data = await checkPaymentStatus(transactionId);
        setStatus(data.statut);
        if (data.statut === 'paye') {
          setSubscriberId(data.subscriberId);
          clearInterval(interval);
        }
        if (data.statut === 'echoue') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error(error);
      }
    }, 3000); // Vérification toutes les 3 secondes

    return () => clearInterval(interval);
  }, [transactionId]);

  if (status === 'paye') {
    return (
      <div className="p-6 text-center">
        <div className="text-green-400 text-4xl mb-4">✅</div>
        <h2 className="text-xl font-bold">Abonnement activé !</h2>
        <p className="text-white/60">
          Votre abonnement a été enregistré. Vous recevrez les identifiants dans vos notifications.
        </p>
        <Link to="/app" className="btn-primary mt-4 inline-block">
          Accéder à mon espace
        </Link>
      </div>
    );
  }

  if (status === 'echoue') {
    return (
      <div className="p-6 text-center">
        <div className="text-red-400 text-4xl mb-4">❌</div>
        <h2 className="text-xl font-bold">Paiement échoué</h2>
        <p className="text-white/60">Veuillez réessayer ou contacter le support.</p>
        <Link to="/app" className="btn-primary mt-4 inline-block">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 text-center">
      <div className="text-yellow-400 text-4xl mb-4">⏳</div>
      <h2 className="text-xl font-bold">Vérification du paiement en cours…</h2>
      <p className="text-white/60">Merci de patienter quelques secondes.</p>
    </div>
  );
}
