import { ROLConfigUpdate } from "@/hooks/useROLConfig";

interface ROLPreviewProps {
  config: {
    nomeCurto: string;
    slogan: string;
    nomeCompleto: string;
    corPrimaria: string;
    corSecundaria: string;
    telefone: string;
    email: string;
    cnpj: string;
    endereco: string;
    exibirLogo: boolean;
    logoUrl: string;
    larguraPapel: string;
    fontePrincipal: string;
    tamanhoNome: number;
    tamanhoItem: number;
    tamanhoTotal: number;
    previsaoEntrega: boolean;
    bloco: boolean;
    observacoes: boolean;
    assinaturaCliente: boolean;
    tipoPreco: boolean;
    linhaDesconto: boolean;
    textoRodape: string;
    margemSuperior: number;
    margemLateral: number;
  };
}

const getFontFamily = (font: string) => {
  switch (font) {
    case 'courier': return 'Courier New, monospace';
    case 'arial': return 'Arial, sans-serif';
    case 'times': return 'Times New Roman, serif';
    case 'consolas': return 'Consolas, monospace';
    default: return 'Courier New, monospace';
  }
};

export function ROLPreview({ config }: ROLPreviewProps) {
  const width = config.larguraPapel === '58mm' ? '220px' : '300px';
  const fontFamily = getFontFamily(config.fontePrincipal);

  // Sample data for preview
  const sampleItems = [
    { qty: 5, name: 'Camisa Social', unit: 8.50, total: 42.50 },
    { qty: 3, name: 'Calça Jeans', unit: 12.00, total: 36.00 },
    { qty: 2, name: 'Vestido', unit: 18.00, total: 36.00 },
  ];
  const subtotal = 114.50;
  const desconto = 11.45;
  const total = 103.05;

  return (
    <div 
      className="bg-white border-2 border-dashed border-gray-300 mx-auto overflow-hidden"
      style={{ 
        width,
        fontFamily,
        padding: `${config.margemSuperior}px ${config.margemLateral}px`,
      }}
    >
      {/* Header */}
      <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
        {config.exibirLogo && config.logoUrl && (
          <div className="flex justify-center mb-2">
            <img 
              src={config.logoUrl} 
              alt="Logo" 
              className="h-12 object-contain"
            />
          </div>
        )}
        <p 
          className="font-bold uppercase"
          style={{ 
            fontSize: `${config.tamanhoNome}px`,
            color: config.corPrimaria
          }}
        >
          {config.nomeCompleto || config.nomeCurto}
        </p>
        {config.cnpj && (
          <p className="text-[10px] text-gray-600">CNPJ: {config.cnpj}</p>
        )}
        {config.endereco && (
          <p className="text-[9px] text-gray-500 mt-1">{config.endereco}</p>
        )}
        {(config.telefone || config.email) && (
          <p className="text-[9px] text-gray-500">
            {config.telefone}{config.telefone && config.email && ' | '}{config.email}
          </p>
        )}
      </div>

      {/* ROL Info */}
      <div className="text-center mb-2">
        <p className="text-[10px] font-bold" style={{ color: config.corSecundaria }}>
          RECIBO DE LAVANDERIA
        </p>
        <p className="text-[9px] text-gray-600">Nº 00001 - 09/01/2026 14:35</p>
      </div>

      {/* Cliente */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
        <p className="text-[10px]"><strong>Cliente:</strong> Maria Silva</p>
        {config.previsaoEntrega && (
          <p className="text-[10px] text-amber-600 font-medium">
            <strong>Previsão:</strong> 12/01/2026
          </p>
        )}
      </div>

      {/* Items */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
        <div className="text-[9px] font-bold flex justify-between mb-1" style={{ color: config.corPrimaria }}>
          <span>QTD</span>
          <span className="flex-1 text-left ml-2">ITEM</span>
          {config.tipoPreco && (
            <>
              <span className="w-12 text-right">UNIT</span>
              <span className="w-14 text-right">TOTAL</span>
            </>
          )}
        </div>
        {sampleItems.map((item, idx) => (
          <div 
            key={idx} 
            className="flex justify-between text-[9px] py-0.5"
            style={{ fontSize: `${config.tamanhoItem}px` }}
          >
            <span className="w-6">{item.qty}x</span>
            <span className="flex-1 text-left truncate">{item.name}</span>
            {config.tipoPreco && (
              <>
                <span className="w-12 text-right">{item.unit.toFixed(2)}</span>
                <span className="w-14 text-right">{item.total.toFixed(2)}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
        {config.tipoPreco && (
          <div className="flex justify-between text-[10px]">
            <span>Subtotal:</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
        )}
        {config.linhaDesconto && config.tipoPreco && (
          <div className="flex justify-between text-[10px] text-emerald-600">
            <span>Desconto (10%):</span>
            <span>- R$ {desconto.toFixed(2)}</span>
          </div>
        )}
        {config.tipoPreco && (
          <div 
            className="flex justify-between font-bold mt-1"
            style={{ 
              fontSize: `${config.tamanhoTotal}px`,
              color: config.corPrimaria
            }}
          >
            <span>TOTAL:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Observações */}
      {config.observacoes && (
        <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
          <p className="text-[9px] text-gray-600">
            <strong>Obs:</strong> Peças com manchas de café. Tratamento especial.
          </p>
        </div>
      )}

      {/* Bloco */}
      {config.bloco && (
        <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
          <p className="text-[9px] text-center text-gray-500">
            Bloco: A | Posição: 15
          </p>
        </div>
      )}

      {/* Assinatura */}
      {config.assinaturaCliente && (
        <div className="border-t border-dashed border-gray-400 pt-4 mb-2">
          <div className="border-b border-gray-400 mx-4 mb-1"></div>
          <p className="text-[9px] text-center text-gray-500">
            Assinatura do Cliente
          </p>
        </div>
      )}

      {/* Rodapé */}
      <div className="border-t border-dashed border-gray-400 pt-2 text-center">
        <p className="text-[9px] text-gray-500">
          {config.textoRodape || 'Obrigado pela preferência!'}
        </p>
        <p className="text-[8px] text-gray-400 mt-1">
          {config.slogan}
        </p>
      </div>
    </div>
  );
}
