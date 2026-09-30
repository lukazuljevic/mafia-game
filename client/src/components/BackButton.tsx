import leftArrowSvg from '../assets/left-arrow.svg';

export default function BackButton({ onClick, label = 'Nazad' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="back-button" onClick={onClick} aria-label={label}>
      <img src={leftArrowSvg} alt="" className="back-arrow-icon" />
    </button>
  );
}
