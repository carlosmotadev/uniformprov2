import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Cliente, OrdemServico } from '../types';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';

const servicoSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  quantidade: z.number().min(1, 'Quantidade deve ser maior que 0'),
  valorUnitario: z.number().min(0, 'Valor unitário deve ser maior ou igual a 0'),
  statusPagamento: z.enum(['PENDENTE', 'PAGO']),
  statusProducao: z.enum(['AGUARDANDO', 'EM_PRODUCAO', 'CONCLUIDO']),
  valorTotal: z.number(),
});

const osSchema = z.object({
  numero: z.string().min(1, 'Número da OS é obrigatório'),
  referencia: z.string().min(1, 'Referência é obrigatória'),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  dataEntrega: z.string().min(1, 'Data de entrega é obrigatória'),
  servicos: z.array(servicoSchema).min(1, 'Adicione pelo menos um serviço'),
});

type OSFormData = z.infer<typeof osSchema>;

export function EditarOS() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<OSFormData>({
    resolver: zodResolver(osSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'servicos',
  });

  const servicos = watch('servicos');

  useEffect(() => {
    Promise.all([loadClientes(), loadOrdem()]).finally(() => {
      setInitialLoading(false);
    });
  }, []);

  async function loadClientes() {
    try {
      const clientesRef = collection(db, 'clientes');
      const q = query(clientesRef, orderBy('nome'));
      const querySnapshot = await getDocs(q);
      const clientesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Cliente[];
      setClientes(clientesData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }

  async function loadOrdem() {
    if (!id) return;

    try {
      const ordemRef = doc(db, 'ordens', id);
      const ordemSnap = await getDoc(ordemRef);

      if (ordemSnap.exists()) {
        const ordemData = ordemSnap.data() as OrdemServico;
        const dataEntrega = ordemData.dataEntrega.toDate();

        reset({
          numero: ordemData.numero,
          referencia: ordemData.referencia,
          clienteId: ordemData.cliente.id,
          dataEntrega: format(dataEntrega, 'yyyy-MM-dd'),
          servicos: ordemData.servicos.map(servico => ({
            ...servico,
            quantidade: Number(servico.quantidade),
            valorUnitario: Number(servico.valorUnitario),
            valorTotal: Number(servico.valorTotal),
          })),
        });
      }
    } catch (error) {
      console.error('Erro ao carregar ordem:', error);
    }
  }

  const adicionarServico = () => {
    append({
      descricao: '',
      quantidade: 1,
      valorUnitario: 0,
      valorTotal: 0,
      statusPagamento: 'PENDENTE',
      statusProducao: 'AGUARDANDO',
    });
  };

  const atualizarValorTotal = (index: number) => {
    const servico = servicos[index];
    if (servico) {
      const valorTotal = servico.quantidade * servico.valorUnitario;
      setValue(`servicos.${index}.valorTotal`, valorTotal);
    }
  };

  const onSubmit = async (data: OSFormData) => {
    if (!id) return;

    setLoading(true);
    try {
      const cliente = clientes.find((c) => c.id === data.clienteId);
      if (!cliente) throw new Error('Cliente não encontrado');

      const ordemRef = doc(db, 'ordens', id);
      const ordemAtualizada: Partial<OrdemServico> = {
        numero: data.numero,
        referencia: data.referencia,
        cliente,
        dataEntrega: new Date(data.dataEntrega),
        servicos: data.servicos,
        valorTotal: data.servicos.reduce((total, s) => total + s.valorTotal, 0),
        updatedAt: new Date(),
      };

      await updateDoc(ordemRef, ordemAtualizada);
      navigate('/os/lista');
    } catch (error) {
      console.error('Erro ao atualizar OS:', error);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Ordem de Serviço</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Número da OS</label>
              <input
                type="text"
                {...register('numero')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Ex: 00001"
              />
              {errors.numero && (
                <p className="mt-1 text-sm text-red-600">{errors.numero.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Referência</label>
              <input
                type="text"
                {...register('referencia')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Ex: Uniforme Escola XYZ"
              />
              {errors.referencia && (
                <p className="mt-1 text-sm text-red-600">{errors.referencia.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Cliente</label>
              <select
                {...register('clienteId')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">Selecione um cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
              {errors.clienteId && (
                <p className="mt-1 text-sm text-red-600">{errors.clienteId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data de Entrega</label>
              <input
                type="date"
                {...register('dataEntrega')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              {errors.dataEntrega && (
                <p className="mt-1 text-sm text-red-600">{errors.dataEntrega.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Serviços</h2>
            <button
              type="button"
              onClick={adicionarServico}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Serviço
            </button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="border-t pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <input
                    type="text"
                    {...register(`servicos.${index}.descricao`)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {errors.servicos?.[index]?.descricao && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.servicos[index]?.descricao?.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    {...register(`servicos.${index}.quantidade`, {
                      valueAsNumber: true,
                      onChange: () => atualizarValorTotal(index),
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {errors.servicos?.[index]?.quantidade && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.servicos[index]?.quantidade?.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Valor Unitário</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register(`servicos.${index}.valorUnitario`, {
                      valueAsNumber: true,
                      onChange: () => atualizarValorTotal(index),
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {errors.servicos?.[index]?.valorUnitario && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.servicos[index]?.valorUnitario?.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Valor Total</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      {...register(`servicos.${index}.valorTotal`)}
                      readOnly
                      className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-1 p-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status de Pagamento
                  </label>
                  <select
                    {...register(`servicos.${index}.statusPagamento`)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="PENDENTE">Pendente</option>
                    <option value="PAGO">Pago</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status de Produção
                  </label>
                  <select
                    {...register(`servicos.${index}.statusProducao`)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="AGUARDANDO">Aguardando</option>
                    <option value="EM_PRODUCAO">Em Produção</option>
                    <option value="CONCLUIDO">Concluído</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          {errors.servicos && (
            <p className="mt-2 text-sm text-red-600">{errors.servicos.message}</p>
          )}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/os/lista')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}