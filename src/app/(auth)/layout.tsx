export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-sm border">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mawthook</h1>
          <p className="text-sm text-gray-500 mt-1">WhatsApp Webhook Middleware</p>
        </div>
        {children}
      </div>
    </div>
  );
}
