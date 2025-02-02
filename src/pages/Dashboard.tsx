import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrdemServico, RecebimentoParcial } from '../types';
import { FileText, DollarSign, AlertCircle } from 'lucide-react';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  eachDayOfInterval, 
  eachMonthOfInterval, 
  eachYearOfInterval, 
  subDays, 
  subMonths, 
  subYears 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export function Dashboard() {
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalOrdens, setTotalOrdens] = useState(0);
  const [ordensEmAtraso, setOrdensEmAtraso] = useState(0);
  const [valorTotalOS, setValorTotalOS] = useState(0);
  const [valorTotalPendente, setValorTotalPendente] = useState(0);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [recebimentos, setRecebimentos] = useState<RecebimentoParcial[]>([]);
  const [periodoGrafico, setPeriodoGrafico] = useState<'diario' | 'mensal' | 'anual'>('diario');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadClientes(),
      loadOrdens(),
      loadRecebimentos()
    ]).finally(() => setLoading(false));
  }, []);

  async function loadClientes() {
    try {
      const clientesSnapshot = await getDocs(collection(db, 'clientes'));
      setTotalClientes(clientesSnapshot.size);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }

  async function loadOrdens() {
    try {
      const ordensRef = collection(db, 'ordens');
      const ordensSnapshot = await getDocs(ordensRef);
      const ordensData = ordensSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dataEmissao: doc.data().dataEmissao.toDate(),
        dataEntrega: doc.data().dataEntrega.toDate()
      })) as OrdemServico[];

      setOrdens(ordensData);
      setTotalOrdens(ordensData.length);

      // Calcula ordens em atraso
      const hoje = new Date();
      const atrasadas = ordensData.filter(ordem => 
        ordem.dataEntrega < hoje && 
        ordem.servicos.some(servico => servico.statusProducao !== 'CONCLUIDO')
      );
      setOrdensEmAtraso(atrasadas.length);

      // Calcula valor total das OS
      const valorTotal = ordensData.reduce((total, ordem) => total + ordem.valorTotal, 0);
      setValorTotalOS(valorTotal);

      // Calcula valor total pendente
      const valorPendente = ordensData.reduce((total, ordem) => {
        const pendente = ordem.servicos.reduce((servicoTotal, servico) => {
          if (servico.statusPagamento === 'PENDENTE') {
            return servicoTotal + servico.valorTotal;
          }
          return servicoTotal;
        }, 0);
        return total + pendente;
      }, 0);
      setValorTotalPendente(valorPendente);
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    }
  }

  async function loadRecebimentos() {
    try {
      const recebimentosRef = collection(db, 'recebimentos_parciais');
      const recebimentosSnapshot = await getDocs(recebimentosRef);
      const recebimentosData = recebimentosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        data: doc.data().data.toDate()
      })) as RecebimentoParcial[];
      setRecebimentos(recebimentosData);
    } catch (error) {
      console.error('Erro ao carregar recebimentos:', error);
    }
  }

  const getValoresPorPeriodo = () => {
    const hoje = new Date();
    let datas: Date[] = [];
    let labels: string[] = [];
    let valores: number[] = [];

    switch (periodoGrafico) {
      case 'diario':
        const inicio = startOfDay(subDays(hoje, 30));
        const fim = endOfDay(hoje);
        datas = eachDayOfInterval({ start: inicio, end: fim });
        labels = datas.map(data => format(data, 'dd/MM', { locale: ptBR }));
        valores = datas.map(data => {
          return ordens
            .filter(ordem => {
              const dataOrdem = startOfDay(ordem.dataEmissao);
              return dataOrdem.getTime() === startOfDay(data).getTime();
            })
            .reduce((total, ordem) => total + ordem.valorTotal, 0);
        });
        break;

      case 'mensal':
        const inicioMes = startOfMonth(subMonths(hoje, 11));
        const fimMes = endOfMonth(hoje);
        datas = eachMonthOfInterval({ start: inicioMes, end: fimMes });
        labels = datas.map(data => format(data, 'MMM/yy', { locale: ptBR }));
        valores = datas.map(data => {
          return ordens
            .filter(ordem => {
              const dataOrdem = ordem.dataEmissao;
              return (
                dataOrdem >= startOfMonth(data) &&
                dataOrdem <= endOfMonth(data)
              );
            })
            .reduce((total, ordem) => total + ordem.valorTotal, 0);
        });
        break;

      case 'anual':
        const inicioAno = startOfYear(subYears(hoje, 4));
        const fimAno = endOfYear(hoje);
        datas = eachYearOfInterval({ start: inicioAno, end: fimAno });
        labels = datas.map(data => format(data, 'yyyy', { locale: ptBR }));
        valores = datas.map(data => {
          return ordens
            .filter(ordem => {
              const dataOrdem = ordem.dataEmissao;
              return (
                dataOrdem >= startOfYear(data) &&
                dataOrdem <= endOfYear(data)
              );
            })
            .reduce((total, ordem) => total + ordem.valorTotal, 0);
        });
        break;
    }

    return { labels, valores };
  };

  const { labels, valores } = getValoresPorPeriodo();

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Valor Total de Serviços',
        data: valores,
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.5)',
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(79, 70, 229)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgb(79, 70, 229)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
            weight: 'bold' as const,
          },
          padding: 20,
        },
      },
      title: {
        display: true,
        text: 'Evolução dos Valores de Serviços',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: 20,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1f2937',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            return `Valor: ${new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 11,
          },
          padding: 8,
          callback: (value: number) => {
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0,
            }).format(value);
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    elements: {
      line: {
        borderWidth: 2,
      },
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-500">Total de OS</h2>
              <p className="text-2xl font-semibold text-gray-900">{totalOrdens}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-500">Valor Total OS</h2>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(valorTotalOS)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-500">Pagamentos Pendentes</h2>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(valorTotalPendente)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-end mb-4">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setPeriodoGrafico('diario')}
              className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${
                periodoGrafico === 'diario'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Diário
            </button>
            <button
              type="button"
              onClick={() => setPeriodoGrafico('mensal')}
              className={`px-4 py-2 text-sm font-medium border-t border-b border-r ${
                periodoGrafico === 'mensal'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setPeriodoGrafico('anual')}
              className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${
                periodoGrafico === 'anual'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Anual
            </button>
          </div>
        </div>
        <div className="h-[400px]">
          <Line options={chartOptions} data={chartData} />
        </div>
      </div>
    </div>
  );
}