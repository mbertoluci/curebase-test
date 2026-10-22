import './global.css';

export const metadata = {
  title: 'Participant Capture · Curebase BMI',
  description: 'Collect demographics and health measurements and compute BMI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
