import './globals.css';
export const metadata = { title: 'Kernel Job Agent', description: 'MVP dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b">
          <div className="container flex h-14 items-center justify-between">
            <div className="font-semibold">Kernel Job Agent</div>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/">Dashboard</a>
              <a href="/upload">Upload</a>
              <a href="/jobs/new">New Job</a>
              <a href="/preferences">Preferences</a>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
      </body>
    </html>
  );
}


