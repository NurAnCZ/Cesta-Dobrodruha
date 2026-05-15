export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body
        style={{
          margin: 0,
          background: '#1a202c',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
