import logging
from core.models import CodeableConcept, DataSource, DataSourceSupportedScope
from rest_framework.viewsets import ModelViewSet
from core.serializers import CodeableConceptSerializer, DataSourceSerializer, DataSourceSupportedScopeSerializer
from rest_framework.response import Response
from rest_framework.decorators import action

logger = logging.getLogger(__name__)

class DataSourceViewSet(ModelViewSet):

    serializer_class = DataSourceSerializer

    # this will never be large
    def get_queryset(self):
        if self.detail:
            # Detail view must return a queryset
            return DataSource.objects.all()
        else:
            return DataSource.data_sources_with_scopes()
            
    @action(detail=False, methods=['GET'])
    def all_scopes(self, request):
        codeable_concepts = CodeableConcept.objects.order_by('text')
        serializer = CodeableConceptSerializer(codeable_concepts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['GET','POST','DELETE'])
    def supported_scopes(self, request, pk):

        if request.method == 'GET': 
            scopes = DataSourceSupportedScope.objects.filter(data_source_id=pk).order_by('id')
            serializer = DataSourceSupportedScopeSerializer(scopes, many=True)
            return Response(serializer.data)
        else:
            response = None
            if request.method == 'POST':
                response = DataSourceSupportedScope.objects.create(data_source_id=pk, scope_code_id=request.data["scope_code_id"])
            else:
                response = DataSourceSupportedScope.objects.filter(data_source_id=pk, scope_code_id=request.data["scope_code_id"]).delete()
        
            return Response(DataSourceSupportedScopeSerializer(response, many=False).data)