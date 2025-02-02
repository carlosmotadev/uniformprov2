import { useState, useEffect, useRef, forwardRef } from 'react';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrdemServico, RecebimentoParcial } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Trash2, FileText, Receipt } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export function ListaOS() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const relatorioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOrdens();
  }, []);

  async function loadOrdens() {
    try {
      const ordensRef = collection(db, 'ordens');
      const q = query(ordensRef, orderBy('dataEmissao', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordensData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        dataEmissao: doc.data().dataEmissao.toDate(),
        dataEntrega: doc.data().dataEntrega.toDate(),
      })) as OrdemServico[];
      setOrdens(ordensData);
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta OS?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'ordens', id));
      await loadOrdens();
    } catch (error) {
      console.error('Erro ao deletar OS:', error);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => relatorioRef.current,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const filteredOrdens = ordens.filter(
    (ordem) =>
      ordem.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ordem.cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ordem.referencia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lista de Ordens de Serviço</h1>
        <div className="flex space-x-4">
          <button
            onClick={handlePrint}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
          >
            <Receipt className="w-4 h-4 mr-2" />
            OS a Receber
          </button>
          <Link
            to="/os/nova"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
          >
            <FileText className="w-4 h-4 mr-2" />
            Nova OS
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Buscar por número, cliente ou referência..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nº OS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referência
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Emissão
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Entrega
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrdens.map((ordem) => (
                  <tr key={ordem.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {ordem.numero}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ordem.cliente.nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ordem.referencia}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(ordem.dataEmissao, 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(ordem.dataEntrega, 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(ordem.valorTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ordem.servicos.every((s) => s.statusProducao === 'CONCLUIDO')
                        ? 'Concluída'
                        : 'Em Produção'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/os/editar/${ordem.id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ordem.id!)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <RelatorioContasReceber ref={relatorioRef} ordens={ordens} />
      </div>
    </div>
  );
}

const RelatorioContasReceber = forwardRef<HTMLDivElement, { ordens: OrdemServico[] }>(
  ({ ordens }, ref) => {
    const [recebimentos, setRecebimentos] = useState<RecebimentoParcial[]>([]);

    useEffect(() => {
      loadRecebimentos();
    }, []);

    async function loadRecebimentos() {
      try {
        const recebimentosRef = collection(db, 'recebimentos_parciais');
        const querySnapshot = await getDocs(recebimentosRef);
        const recebimentosData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          data: doc.data().data.toDate(),
        })) as RecebimentoParcial[];
        setRecebimentos(recebimentosData);
      } catch (error) {
        console.error('Erro ao carregar recebimentos:', error);
      }
    }

    const getRecebimentosPorOrdem = (ordemId: string) => {
      return recebimentos
        .filter((r) => r.ordemId === ordemId)
        .reduce((total, r) => total + r.valor, 0);
    };

    const valorTotalReceber = ordens.reduce((total, ordem) => {
      const valorPendente = ordem.servicos.reduce((servicoTotal, servico) => {
        if (servico.statusPagamento === 'PENDENTE') {
          return servicoTotal + servico.valorTotal;
        }
        return servicoTotal;
      }, 0);
      const recebimentosParciais = getRecebimentosPorOrdem(ordem.id!);
      return total + (valorPendente - recebimentosParciais);
    }, 0);

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    };

    const truncateText = (text: string, maxLength: number) => {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength) + '...';
    };

    return (
      <div ref={ref} className="p-8">
        <h1 className="text-2xl font-bold mb-6">Relatório de OS a Receber</h1>
        <p className="text-gray-600 mb-4">
          Data de emissão: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>

        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2">Nº OS</th>
              <th className="text-left py-2">Cliente</th>
              <th className="text-left py-2">Referência</th>
              <th className="text-left py-2">Data Entrega</th>
              <th className="text-right py-2">Valor Total</th>
              <th className="text-right py-2">Recebido</th>
              <th className="text-right py-2">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {ordens.map((ordem) => {
              const valorPendente = ordem.servicos.reduce((total, servico) => {
                if (servico.statusPagamento === 'PENDENTE') {
                  return total + servico.valorTotal;
                }
                return total;
              }, 0);

              const recebimentosParciais = getRecebimentosPorOrdem(ordem.id!);
              const saldo = valorPendente - recebimentosParciais;

              if (saldo > 0) {
                return (
                  <tr key={ordem.id} className="border-b border-gray-100">
                    <td className="py-2">{ordem.numero}</td>
                    <td className="py-2">{ordem.cliente.nome}</td>
                    <td className="py-2">{truncateText(ordem.referencia, 12)}</td>
                    <td className="py-2">
                      {format(ordem.dataEntrega, 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="py-2 text-right">{formatCurrency(valorPendente)}</td>
                    <td className="py-2 text-right">{formatCurrency(recebimentosParciais)}</td>
                    <td className="py-2 text-right">{formatCurrency(saldo)}</td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 font-bold">
              <td colSpan={6} className="py-2 text-right">
                Total a Receber:
              </td>
              <td className="py-2 text-right">{formatCurrency(valorTotalReceber)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }
);