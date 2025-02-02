import { useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Cliente, OrdemServico } from '../types';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const servicoSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  quantidade: z.number().min(1, 'Quantidade deve ser maior que 0'),
  valorUnitario: z.number().min(0, 'Valor unitário deve ser maior ou igual a 0'),
  statusPagamento: z.enum(['PENDENTE', 'PAGO']),
  statusProducao: z.enum(['AGUARDANDO', 'EM_PRODUCAO', 'CONCLUIDO']),
  valorTotal: z.number(),
});

const osSchema = z.object({
  referencia: z.string().min(1, 'Referência é obrigatória'),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  dataEntrega: z.string().min(1, 'Data de entrega é obrigatória'),
  servicos: z.array(servicoSchema).min(1, 'Adicione pelo menos um serviço'),
});

type OSFormData = z.infer<typeof osSchema>;

export function NovaOS() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<OSFormData>({
    resolver: zodResolver(osSchema),
    defaultValues: {
      servicos: [
        {
          descricao: '',
          quantidade: 1,
          valorUnitario: 0,
          valorTotal: 0,
          statusPagamento: 'PENDENTE',
          statusProducao: 'AGUARDANDO',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'servicos',
  });

  const servicos = watch('servicos');

  useState(() => {
    loadClientes();
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

  async function getNextOSNumber() {
    try {
      const ordensRef = collection(db, 'ordens');
      const q = query(ordensRef, orderBy('numero', 'desc'), where('numero', '>=', '00001'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return '00001';
      }

      const lastOS = querySnapshot.docs[0].data();
      const lastNumber = parseInt(lastOS.numero);
      return String(lastNumber + 1).padStart(5, '0');
    } catch (error) {
      console.error('Erro ao gerar número da OS:', error);
      return '00001';
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
    setLoading(true);
    try {
      const cliente = clientes.find((c) => c.id === data.clienteId);
      if (!cliente) throw new Error('Cliente não encontrado');

      const numero = await getNextOSNumber();

      const novaOS: Omit<OrdemServico, 'id'> = {
        numero,
        referencia: data.referencia,
        cliente,
        dataEmissao: new Date(),
        dataEntrega: new Date(data.dataEntrega),
        servicos: data.servicos,
        valorTotal: data.servicos.reduce((total, s) => total + s.valorTotal, 0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'ordens'), novaOS);
      navigate('/os/lista');
    } catch (error) {
      console.error('Erro ao salvar OS:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Ordem de Serviço</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Seção de Serviços */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Serviços</h2>
            <button
              type="button"
              onClick={adicionarServico}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Serviço
            </button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="space-y-4 pb-4 border-b border-gray-200 last:border-0">
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
                  <input
                    type="number"
                    step="0.01"
                    {...register(`servicos.${index}.valorTotal`, { valueAsNumber: true })}
                    disabled
                    className="mt-1 block w-full rounded-md bg-gray-50 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Status Pagamento</label>
                  <select
                    {...register(`servicos.${index}.statusPagamento`)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="PENDENTE">Pendente</option>
                    <option value="PAGO">Pago</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Status Produção</label>
                  <select
                    {...register(`servicos.${index}.statusProducao`)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="AGUARDANDO">Aguardando</option>
                    <option value="EM_PRODUCAO">Em Produção</option>
                    <option value="CONCLUIDO">Concluído</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}

          {errors.servicos && !Array.isArray(errors.servicos) && (
            <p className="mt-2 text-sm text-red-600">{errors.servicos.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar OS'}
          </button>
        </div>
      </form>
    </div>
  );
}