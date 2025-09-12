import { SVGProps } from 'react';

interface MicrosoftLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export const MicrosoftLogo: React.FC<MicrosoftLogoProps> = ({
  size = 20,
  className = '',
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 23 23"
      className={className}
      aria-label="Microsoft"
      {...props}
    >
      {/* Microsoft logo squares */}
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
};
