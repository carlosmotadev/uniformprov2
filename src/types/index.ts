export interface Cliente {
  id?: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  endereco: {
    rua: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
}

export interface Servico {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  statusPagamento: 'PENDENTE' | 'PAGO';
  statusProducao: 'AGUARDANDO' | 'EM_PRODUCAO' | 'CONCLUIDO';
}

export interface RecebimentoParcial {
  id?: string;
  ordemId: string;
  valor: number;
  data: Date;
  observacao?: string;
}

export interface OrdemServico {
  id?: string;
  numero: string;
  referencia: string;
  cliente: Cliente;
  dataEmissao: Date;
  dataEntrega: Date;
  servicos: Servico[];
  valorTotal: number;
  createdAt: Date;
  updatedAt: Date;
}