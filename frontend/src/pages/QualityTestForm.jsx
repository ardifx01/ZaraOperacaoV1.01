import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import api, { machineService } from '../services/api';
import MediaUpload from '../components/ui/MediaUpload';

const QualityTestForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  
  const [formData, setFormData] = useState({
    machineId: '',
    product: '',
    lot: '',
    boxNumber: '',
    packageSize: '',
    packageWidth: '',
    bottomSize: '',
    sideSize: '',
    zipperDistance: '',
    facilitatorDistance: '',
    rulerTestDone: false,
    hermeticityTestDone: false,
    observations: '',
    // Novos campos de inspeção de qualidade
    visualInspection: null,
    dimensionalCheck: null,
    colorConsistency: null,
    surfaceQuality: null,
    adhesionTest: null
  });

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      const response = await api.get('/machines');
      const machinesData = response.data.data || response.data;
      setMachines(Array.isArray(machinesData) ? machinesData : []);
    } catch (error) {
      console.error('Erro ao carregar máquinas:', error);
      setError('Erro ao carregar máquinas');
      setMachines([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('=== INÍCIO DO HANDLESUBMIT ==>');
    console.log('FormData completo:', formData);
    
    // Verificar campos obrigatórios
    const requiredFields = ['machineId', 'product', 'lot', 'quantity'];
    const emptyFields = requiredFields.filter(field => !formData[field]);
    console.log('Campos obrigatórios vazios:', emptyFields);
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Debug: verificar se machineId está definido
      console.log('FormData machineId:', formData.machineId);
      console.log('Tipo do machineId:', typeof formData.machineId);
      console.log('MachineId é truthy?', !!formData.machineId);
      
      const testData = {
        ...formData,
        media: mediaFiles
      };

      const qualityTestsService = (await import('../services/qualityTests')).default;
      await qualityTestsService.createTest(testData);
      setSuccess('Teste de qualidade criado com sucesso!');
      
      setTimeout(() => {
        navigate('/quality-tests');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erro ao criar teste de qualidade');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/quality-tests');
  };

  return (
    <>
      <Helmet>
        <title>Novo Teste de Qualidade - Zara Operação</title>
        <meta name="description" content="Criar novo teste de qualidade" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
              Voltar
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Novo Teste de Qualidade</h1>
              <p className="mt-1 text-sm text-gray-500">
                Registre um novo teste de qualidade no sistema
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card de Informações Básicas */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="machineId" className="block text-sm font-medium text-gray-700">
                  Máquina *
                </label>
                <select
                  id="machineId"
                  name="machineId"
                  value={formData.machineId}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Selecione a máquina</option>
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name} - {machine.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="product" className="block text-sm font-medium text-gray-700">
                  Produto *
                </label>
                <input
                  type="text"
                  id="product"
                  name="product"
                  value={formData.product}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ex: Embalagem 500g"
                />
              </div>

              <div>
                <label htmlFor="lot" className="block text-sm font-medium text-gray-700">
                  Lote *
                </label>
                <input
                  type="text"
                  id="lot"
                  name="lot"
                  value={formData.lot}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ex: L2024001"
                />
              </div>

              <div>
                <label htmlFor="boxNumber" className="block text-sm font-medium text-gray-700">
                  Número da Caixa *
                </label>
                <input
                  type="text"
                  id="boxNumber"
                  name="boxNumber"
                  value={formData.boxNumber}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ex: BOX-001"
                />
              </div>
            </div>
          </div>

          {/* Card de Parâmetros Técnicos */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Parâmetros Técnicos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="packageSize" className="block text-sm font-medium text-gray-700">
                  Tamanho da Embalagem (mm) *
                </label>
                <input
                  type="number"
                  id="packageSize"
                  name="packageSize"
                  value={formData.packageSize}
                  onChange={handleInputChange}
                  required
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ex: 250"
                />
              </div>

              <div>
                <label htmlFor="packageWidth" className="block text-sm font-medium text-gray-700">
                  Largura da Embalagem (mm) *
                </label>
                <input
                  type="number"
                  id="packageWidth"
                  name="packageWidth"
                  value={formData.packageWidth}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="0.25"
                />
              </div>

              <div>
                <label htmlFor="bottomSize" className="block text-sm font-medium text-gray-700">
                  Tamanho do Fundo (mm) *
                </label>
                <input
                  type="number"
                  id="bottomSize"
                  name="bottomSize"
                  value={formData.bottomSize}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="10.0"
                />
              </div>

              <div>
                <label htmlFor="sideSize" className="block text-sm font-medium text-gray-700">
                  Tamanho da Lateral (mm) *
                </label>
                <input
                  type="number"
                  id="sideSize"
                  name="sideSize"
                  value={formData.sideSize}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="15.0"
                />
              </div>

              <div>
                <label htmlFor="zipperDistance" className="block text-sm font-medium text-gray-700">
                  Distância do Zíper (mm) *
                </label>
                <input
                  type="number"
                  id="zipperDistance"
                  name="zipperDistance"
                  value={formData.zipperDistance}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="2.0"
                />
              </div>

              <div>
                <label htmlFor="facilitatorDistance" className="block text-sm font-medium text-gray-700">
                  Distância do Facilitador (mm) *
                </label>
                <input
                  type="number"
                  id="facilitatorDistance"
                  name="facilitatorDistance"
                  value={formData.facilitatorDistance}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="1.5"
                />
              </div>
            </div>
          </div>

          {/* Card de Inspeção de Qualidade */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Inspeção de Qualidade</h3>
            
            {/* Itens de Inspeção */}
             <div>
               <h4 className="text-md font-medium text-gray-800 mb-4">Itens de Inspeção</h4>
               <div className="space-y-6">
                 {/* Inspeção Visual */}
                 <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                   <h5 className="text-sm font-medium text-gray-900 mb-3">Inspeção Visual</h5>
                   <p className="text-xs text-gray-500 mb-3">Verificação visual da qualidade</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.visualInspection === true 
                           ? 'border-green-500 bg-green-50' 
                           : 'border-gray-200 bg-white hover:border-green-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, visualInspection: true }))}
                     >
                       <div className="flex items-center justify-center">
                         <CheckCircleIcon className={`h-5 w-5 mr-2 ${
                           formData.visualInspection === true ? 'text-green-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.visualInspection === true ? 'text-green-800' : 'text-gray-600'
                         }`}>
                           Aprovado
                         </span>
                       </div>
                     </div>
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.visualInspection === false 
                           ? 'border-red-500 bg-red-50' 
                           : 'border-gray-200 bg-white hover:border-red-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, visualInspection: false }))}
                     >
                       <div className="flex items-center justify-center">
                         <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${
                           formData.visualInspection === false ? 'text-red-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.visualInspection === false ? 'text-red-800' : 'text-gray-600'
                         }`}>
                           Não Aprovado
                         </span>
                       </div>
                     </div>
                   </div>
                 </div>
 
                 {/* Verificação Dimensional */}
                 <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                   <h5 className="text-sm font-medium text-gray-900 mb-3">Verificação Dimensional</h5>
                   <p className="text-xs text-gray-500 mb-3">Medição de dimensões críticas</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.dimensionalCheck === true 
                           ? 'border-green-500 bg-green-50' 
                           : 'border-gray-200 bg-white hover:border-green-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, dimensionalCheck: true }))}
                     >
                       <div className="flex items-center justify-center">
                         <CheckCircleIcon className={`h-5 w-5 mr-2 ${
                           formData.dimensionalCheck === true ? 'text-green-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.dimensionalCheck === true ? 'text-green-800' : 'text-gray-600'
                         }`}>
                           Aprovado
                         </span>
                       </div>
                     </div>
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.dimensionalCheck === false 
                           ? 'border-red-500 bg-red-50' 
                           : 'border-gray-200 bg-white hover:border-red-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, dimensionalCheck: false }))}
                     >
                       <div className="flex items-center justify-center">
                         <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${
                           formData.dimensionalCheck === false ? 'text-red-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.dimensionalCheck === false ? 'text-red-800' : 'text-gray-600'
                         }`}>
                           Não Aprovado
                         </span>
                       </div>
                     </div>
                   </div>
                 </div>
 
                 {/* Consistência de Cor */}
                 <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                   <h5 className="text-sm font-medium text-gray-900 mb-3">Consistência de Cor</h5>
                   <p className="text-xs text-gray-500 mb-3">Verificação da uniformidade da cor</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.colorConsistency === true 
                           ? 'border-green-500 bg-green-50' 
                           : 'border-gray-200 bg-white hover:border-green-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, colorConsistency: true }))}
                     >
                       <div className="flex items-center justify-center">
                         <CheckCircleIcon className={`h-5 w-5 mr-2 ${
                           formData.colorConsistency === true ? 'text-green-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.colorConsistency === true ? 'text-green-800' : 'text-gray-600'
                         }`}>
                           Aprovado
                         </span>
                       </div>
                     </div>
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.colorConsistency === false 
                           ? 'border-red-500 bg-red-50' 
                           : 'border-gray-200 bg-white hover:border-red-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, colorConsistency: false }))}
                     >
                       <div className="flex items-center justify-center">
                         <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${
                           formData.colorConsistency === false ? 'text-red-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.colorConsistency === false ? 'text-red-800' : 'text-gray-600'
                         }`}>
                           Não Aprovado
                         </span>
                       </div>
                     </div>
                   </div>
                 </div>
 
                 {/* Qualidade da Superfície */}
                 <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                   <h5 className="text-sm font-medium text-gray-900 mb-3">Qualidade da Superfície</h5>
                   <p className="text-xs text-gray-500 mb-3">Análise da textura e acabamento</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.surfaceQuality === true 
                           ? 'border-green-500 bg-green-50' 
                           : 'border-gray-200 bg-white hover:border-green-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, surfaceQuality: true }))}
                     >
                       <div className="flex items-center justify-center">
                         <CheckCircleIcon className={`h-5 w-5 mr-2 ${
                           formData.surfaceQuality === true ? 'text-green-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.surfaceQuality === true ? 'text-green-800' : 'text-gray-600'
                         }`}>
                           Aprovado
                         </span>
                       </div>
                     </div>
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.surfaceQuality === false 
                           ? 'border-red-500 bg-red-50' 
                           : 'border-gray-200 bg-white hover:border-red-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, surfaceQuality: false }))}
                     >
                       <div className="flex items-center justify-center">
                         <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${
                           formData.surfaceQuality === false ? 'text-red-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.surfaceQuality === false ? 'text-red-800' : 'text-gray-600'
                         }`}>
                           Não Aprovado
                         </span>
                       </div>
                     </div>
                   </div>
                 </div>
 
                 {/* Teste de Aderência */}
                 <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                   <h5 className="text-sm font-medium text-gray-900 mb-3">Teste de Aderência</h5>
                   <p className="text-xs text-gray-500 mb-3">Verificação da aderência dos materiais</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.adhesionTest === true 
                           ? 'border-green-500 bg-green-50' 
                           : 'border-gray-200 bg-white hover:border-green-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, adhesionTest: true }))}
                     >
                       <div className="flex items-center justify-center">
                         <CheckCircleIcon className={`h-5 w-5 mr-2 ${
                           formData.adhesionTest === true ? 'text-green-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.adhesionTest === true ? 'text-green-800' : 'text-gray-600'
                         }`}>
                           Aprovado
                         </span>
                       </div>
                     </div>
                     <div 
                       className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                         formData.adhesionTest === false 
                           ? 'border-red-500 bg-red-50' 
                           : 'border-gray-200 bg-white hover:border-red-300'
                       }`}
                       onClick={() => setFormData(prev => ({ ...prev, adhesionTest: false }))}
                     >
                       <div className="flex items-center justify-center">
                         <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${
                           formData.adhesionTest === false ? 'text-red-600' : 'text-gray-400'
                         }`} />
                         <span className={`text-sm font-medium ${
                           formData.adhesionTest === false ? 'text-red-800' : 'text-gray-600'
                         }`}>
                           Não Aprovado
                         </span>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
          </div>

          {/* Card de Testes Realizados */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Testes Realizados</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Teste da Régua */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                formData.rulerTestDone 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="rulerTestDone"
                    name="rulerTestDone"
                    checked={formData.rulerTestDone}
                    onChange={handleInputChange}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="rulerTestDone" className="ml-3 block text-sm font-medium text-gray-900">
                    Teste da Régua
                  </label>
                </div>
                <p className="mt-2 text-xs text-gray-500 ml-8">
                  Verificação das dimensões da embalagem
                </p>
              </div>

              {/* Teste de Hermeticidade */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                formData.hermeticityTestDone 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="hermeticityTestDone"
                    name="hermeticityTestDone"
                    checked={formData.hermeticityTestDone}
                    onChange={handleInputChange}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hermeticityTestDone" className="ml-3 block text-sm font-medium text-gray-900">
                    Teste de Hermeticidade
                  </label>
                </div>
                <p className="mt-2 text-xs text-gray-500 ml-8">
                  Verificação da vedação da embalagem
                </p>
              </div>
            </div>
          </div>

          {/* Card de Mídia */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Anexos</h3>
            <MediaUpload
              media={mediaFiles}
              onMediaAdd={(mediaItem) => setMediaFiles(prev => [...prev, mediaItem])}
              onMediaRemove={(mediaId) => setMediaFiles(prev => prev.filter(item => item.id !== mediaId))}
              maxFiles={5}
              acceptedTypes={['image/*', 'video/*']}
            />
          </div>

          {/* Card de Observações */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Observações</h3>
            
            <div>
              <label htmlFor="observations" className="block text-sm font-medium text-gray-700">
                Observações
              </label>
              <textarea
                id="observations"
                name="observations"
                value={formData.observations}
                onChange={handleInputChange}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Descreva observações adicionais sobre o teste..."
              />
            </div>
          </div>

          {/* Cards de Resultado do Teste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card Aprovado */}
            <div 
              className={`bg-white shadow rounded-lg p-6 border-2 cursor-pointer transition-all ${
                formData.approved === true 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-green-300'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, approved: true }))}
            >
              <div className="flex items-center justify-center mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  formData.approved === true ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h4 className={`text-center font-medium ${
                formData.approved === true ? 'text-green-700' : 'text-gray-700'
              }`}>
                APROVADO
              </h4>
              <p className="text-center text-sm text-gray-500 mt-2">
                Teste passou em todos os critérios
              </p>
            </div>

            {/* Card Reprovado */}
            <div 
              className={`bg-white shadow rounded-lg p-6 border-2 cursor-pointer transition-all ${
                formData.approved === false 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-gray-200 hover:border-red-300'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, approved: false }))}
            >
              <div className="flex items-center justify-center mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  formData.approved === false ? 'bg-red-500' : 'bg-gray-300'
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h4 className={`text-center font-medium ${
                formData.approved === false ? 'text-red-700' : 'text-gray-700'
              }`}>
                REPROVADO
              </h4>
              <p className="text-center text-sm text-gray-500 mt-2">
                Teste não atendeu aos critérios
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              onClick={() => console.log('Botão submit clicado!')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Criando...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="-ml-1 mr-2 h-4 w-4" />
                  Criar Teste
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default QualityTestForm;