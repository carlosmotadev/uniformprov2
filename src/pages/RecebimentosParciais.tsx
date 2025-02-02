import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RecebimentoParcial, OrdemServico } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const recebimentoSchema = z.object({
  ordemId: z.string().min(1, 'Ordem de Serviço é obrigatória'),
  valor: z.number().min(0.01, 'Valor deve ser maior que zero'),
  data: z.string().min(1, 'Data é obrigatória'),
  observacao: z.string().optional(),
});

type RecebimentoFormData = z.infer<typeof recebimentoSchema>;

export function RecebimentosParciais() {
  const [recebimentos, setRecebimentos] = useState<RecebimentoParcial[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RecebimentoFormData>({
    resolver: zodResolver(recebimentoSchema),
  });

  useEffect(() => {
    Promise.all([loadRecebimentos(), loadOrdens()]).finally(() => {
      setLoading(false);
    });
  }, []);

  async function loadRecebimentos() {
    try {
      const recebimentosRef = collection(db, 'recebimentos_parciais');
      const q = query(recebimentosRef, orderBy('data', 'desc'));
      const querySnapshot = await getDocs(q);
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
    }
  }

  const getRecebimentosPorOrdem = (ordemId: string) => {
    return recebimentos
      .filter((r) => r.ordemId === ordemId)
      .reduce((total, r) => total + r.valor, 0);
  };

  const getValorPendente = (ordem: OrdemServico) => {
    const valorTotal = ordem.servicos.reduce((total, servico) => {
      if (servico.statusPagamento === 'PENDENTE') {
        return total + servico.valorTotal;
      }
      return total;
    }, 0);
    const recebido = getRecebimentosPorOrdem(ordem.id!);
    return valorTotal - recebido;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const onSubmit = async (data: RecebimentoFormData) => {
    try {
      const recebimentoData = {
        ...data,
        data: new Date(data.data),
        valor: Number(data.valor),
      };

      if (editingId) {
        await updateDoc(doc(db, 'recebimentos_parciais', editingId), recebimentoData);
      } else {
        await addDoc(collection(db, 'recebimentos_parciais'), recebimentoData);
      }

      await loadRecebimentos();
      setShowForm(false);
      setEditingId(null);
      reset();
    } catch (error) {
      console.error('Erro ao salvar recebimento:', error);
    }
  };

  const handleEdit = (recebimento: RecebimentoParcial) => {
    setEditingId(recebimento.id);
    setValue('ordemId', recebimento.ordemId);
    setValue('valor', recebimento.valor);
    setValue('data', format(recebimento.data, 'yyyy-MM-dd'));
    setValue('observacao', recebimento.observacao || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este recebimento?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'recebimentos_parciais', id));
      await loadRecebimentos();
    } catch (error) {
      console.error('Erro ao deletar recebimento:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getOrdemById = (id: string) => {
    return ordens.find((ordem) => ordem.id === id);
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recebimentos Parciais</h1>
        <button
          onClick={() => {
            setEditingId(null);
            reset();
            setShowForm(!showForm);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Recebimento
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ordem de Serviço</label>
                <select
                  {...register('ordemId')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Selecione uma OS</option>
                  {ordens.map((ordem) => (
                    <option key={ordem.id} value={ordem.id}>
                      OS #{ordem.numero} - {truncateText(ordem.referencia, 12)} - {formatCurrency(getValorPendente(ordem))}
                    </option>
                  ))}
                </select>
                {errors.ordemId && (
                  <p className="mt-1 text-sm text-red-600">{errors.ordemId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('valor', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                {errors.valor && (
                  <p className="mt-1 text-sm text-red-600">{errors.valor.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Data</label>
                <input
                  type="date"
                  {...register('data')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                {errors.data && (
                  <p className="mt-1 text-sm text-red-600">{errors.data.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Observação</label>
                <input
                  type="text"
                  {...register('observacao')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {editingId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
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
                    OS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referência
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total OS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Pendente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Recebido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recebimentos.map((recebimento) => {
                  const ordem = getOrdemById(recebimento.ordemId);
                  if (!ordem) return null;
                  return (
                    <tr key={recebimento.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ordem.numero}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ordem.cliente.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {truncateText(ordem.referencia, 12)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(ordem.valorTotal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(getValorPendente(ordem))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(recebimento.data, 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(recebimento.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(recebimento)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(recebimento.id!)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}