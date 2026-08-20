import CardsVisualPage from "./cards/CardsVisualPage";

type CardsPageProps = { onNavigate: (path: string) => void };

export default function CardsPage({ onNavigate }: CardsPageProps) {
  return <CardsVisualPage onNavigate={onNavigate} />;
}
