import React, { useState } from 'react';
import { getApiUrl, apiConfig } from '../config/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { Search, Wrench, Package, Cable, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface SKUTestResult {
  matched: boolean;
  needsReview: boolean;
  explanation: string;
  candidate?: {
    skuCode: string;
    description: string;
    rateInr: number;
    material: string;
  };
  candidates?: Array<{
    sku: {
      skuCode: string;
      description: string;
      rateInr: number;
      material: string;
    };
    score: number;
    reasons: string[];
  }>;
}


export const SKUTester: React.FC = () => {
  const [description, setDescription] = useState('');
  const [sizeOdMm, setSizeOdMm] = useState('');
  const [material, setMaterial] = useState('');
  const [gauge, setGauge] = useState('');
  const [colour, setColour] = useState('');
  const [result, setResult] = useState<SKUTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { token, isAuthenticated } = useAuth();

  const testSKU = async () => {
    setLoading(true);
    setResult(null);

    try {
      const payload: any = { description };
      if (sizeOdMm) payload.sizeOdMm = parseFloat(sizeOdMm);
      if (material) payload.material = material;
      if (gauge) payload.gauge = gauge;
      if (colour) payload.colour = colour;

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl(apiConfig.endpoints.sku.test), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'SKU test failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response as JSON, use the status text
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Server returned invalid response format. Please check if the backend is running correctly.');
      }
      
      setResult(data);
    } catch (error: any) {
      console.error('Error testing SKU:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (sample: string) => {
    switch (sample) {
      case 'corrugated':
        setDescription('corrugated pipe 25mm');
        setSizeOdMm('25');
        setMaterial('PP');
        setGauge('');
        setColour('');
        break;
      case 'pvc':
        setDescription('PVC conduit 20mm medium');
        setSizeOdMm('20');
        setMaterial('PVC');
        setGauge('M');
        setColour('');
        break;
      case 'fanbox':
        setDescription('GI fan box 3 inch octagonal');
        setSizeOdMm('3');
        setMaterial('MS');
        setGauge('');
        setColour('');
        break;
      case 'gland':
        setDescription('PG13.5 nylon gland');
        setSizeOdMm('13.5');
        setMaterial('NYLON');
        setGauge('');
        setColour('BLACK');
        break;
    }
  };

  const sampleProducts = [
    { id: 'corrugated', label: 'Corrugated Pipe', icon: Wrench },
    { id: 'pvc', label: 'PVC Conduit', icon: Package },
    { id: 'fanbox', label: 'Fan Box', icon: Package },
    { id: 'gland', label: 'Cable Gland', icon: Cable }
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600 mb-6">
          Test the SKU mapping engine with different product descriptions and specifications.
        </p>

        {/* Authentication Warning */}
        {!isAuthenticated && (
          <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">Authentication Recommended</p>
                <p className="text-xs text-amber-700">Sign in for better SKU testing experience and to save your results.</p>
              </div>
            </div>
          </div>
        )}

        {/* Sample Buttons */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Quick Samples:
          </label>
          <div className="flex flex-wrap gap-3">
            {sampleProducts.map((sample) => {
              const IconComponent = sample.icon;
              return (
                <Button
                  key={sample.id}
                  variant="outline"
                  onClick={() => loadSample(sample.id)}
                  className="flex items-center space-x-2"
                >
                  <IconComponent className="h-4 w-4" />
                  <span>{sample.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Description *
            </label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., corrugated pipe 25mm"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Size (mm)
            </label>
            <Input
              type="number"
              value={sizeOdMm}
              onChange={(e) => setSizeOdMm(e.target.value)}
              placeholder="e.g., 25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Material
            </label>
            <Select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
            >
              <option value="">Select material...</option>
              <option value="PP">PP</option>
              <option value="FRPP">FRPP</option>
              <option value="PVC">PVC</option>
              <option value="MS">MS</option>
              <option value="NYLON">NYLON</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gauge
            </label>
            <Select
              value={gauge}
              onChange={(e) => setGauge(e.target.value)}
            >
              <option value="">Select gauge...</option>
              <option value="L">Light</option>
              <option value="M">Medium</option>
              <option value="H">Heavy</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colour
            </label>
            <Select
              value={colour}
              onChange={(e) => setColour(e.target.value)}
            >
              <option value="">Select colour...</option>
              <option value="BLACK">Black</option>
              <option value="GREY">Grey</option>
              <option value="IVORY">Ivory</option>
              <option value="NATURAL">Natural</option>
            </Select>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={testSKU}
            disabled={!description.trim() || loading}
            size="lg"
            className="min-w-[200px]"
          >
            <Search className="mr-2 h-4 w-4" />
            {loading ? 'Testing...' : 'Test SKU Mapping'}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">Test Results</h3>

            {/* Match Status */}
            <div className={`p-4 rounded-lg border ${result.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center space-x-3 mb-3">
                {result.matched ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <h4 className={`font-semibold ${result.matched ? 'text-green-800' : 'text-red-800'}`}>
                    {result.matched ? 'Match Found' : 'No Confident Match'}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">{result.explanation}</p>
                </div>
              </div>
            </div>

            {/* Best Match */}
            {result.candidate && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Best Match:</h4>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <span className="text-sm text-gray-500">SKU Code:</span>
                      <div className="font-semibold">{result.candidate.skuCode}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Material:</span>
                      <div className="font-semibold">{result.candidate.material}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Rate:</span>
                      <div className="font-semibold text-green-600">₹{result.candidate.rateInr}</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Description:</span>
                    <div className="font-medium">{result.candidate.description}</div>
                  </div>
                </div>
              </div>
            )}

            {/* All Candidates */}
            {result.candidates && result.candidates.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  All Candidates ({result.candidates.length}):
                </h4>
                <div className="space-y-3">
                  {result.candidates.slice(0, 5).map((candidate, index) => (
                    <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-900">{candidate.sku.skuCode}</div>
                        <Badge
                          variant={candidate.score > 0.7 ? 'default' : candidate.score > 0.5 ? 'secondary' : 'destructive'}
                        >
                          {(candidate.score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {candidate.sku.description}
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Reasons:</span> {candidate.reasons.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
