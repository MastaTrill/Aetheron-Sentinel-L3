import '../globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-zinc-900 border-r border-zinc-800 p-6">
          <h1 className="text-xl font-bold mb-6">Sentinel L3</h1>

          <nav className="space-y-4">
            <button className="block w-full text-left py-2 px-3 rounded bg-zinc-800 hover:bg-zinc-700">
              Dashboard
            </button>
            <button className="block w-full text-left py-2 px-3 rounded hover:bg-zinc-800">
              Logs
            </button>
            <button className="block w-full text-left py-2 px-3 rounded hover:bg-zinc-800">
              Settings
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </body>
    </html>
  );
}
