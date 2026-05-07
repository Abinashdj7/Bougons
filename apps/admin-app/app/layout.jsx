import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Bougons Admin',
  description: 'Admin dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1f2937', color: '#fff' }
        }} />
        {children}
      </body>
    </html>
  );
}
